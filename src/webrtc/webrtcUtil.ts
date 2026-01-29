import configs from "@config";
import { loggingToGcp } from "../log/gcpLog.js";
import { log } from "../log/logUtil.js";
import { fetchJson, storeId } from "../util/util.js";
import { Camera, JCodec } from "../types.js";

let setupVideoStreamCount = 0;

const setupTrackEventHandler = (
  connection: RTCPeerConnection,
  stream: MediaStream,
  cameraIdx: string
) => {
  connection.ontrack = (event) => {
    stream.addTrack(event.track);
    const video = document.getElementById(`video${cameraIdx}`);

    if (video instanceof HTMLVideoElement) {
      video.srcObject = stream;
      video.onloadeddata = () =>
        log(
          "cameraIdx",
          cameraIdx,
          `video${cameraIdx} resolution:`,
          video.videoWidth,
          video.videoHeight
        );
    } else {
      log("cameraIdx", cameraIdx, `element is not a video element`);
    }

    log(
      "cameraIdx",
      cameraIdx,
      `received track:`,
      event.track,
      event.track.getSettings()
    );
  };
};

const initStream = async (cameraIdx: string, camera: Camera) => {
  const stream = {
    [cameraIdx]: {
      VOD: false,
      disableAudio: true,
      debug: false,
      url: `rtsp://${camera.id}:${camera.password}@${camera.ip}:554/stream2`,
    },
  };
  await fetch(`${configs.rtcServerUrl}/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ streams: stream, storeId }),
  });
};

const fetchStreamCodecs = async (cameraIdx: string): Promise<JCodec[]> => {
  return await fetchJson(`${configs.rtcServerUrl}/stream/codec/${cameraIdx}`);
};

const initConnections = async (
  connection: RTCPeerConnection,
  cameraIdx: string,
  camera: Camera
) => {
  try {
    if (setupVideoStreamCount > 30) {
      loggingToGcp(
        "ERROR",
        `initConnection attempts failed over 30 MiniPC restart`
      );
      await fetchJson(`${configs.rtcServerUrl}/restart`);
    }

    await initStream(cameraIdx, camera);
    const streamCodecs = await fetchStreamCodecs(cameraIdx);

    if (!streamCodecs || streamCodecs.length === 0) {
      throw Error("received no streams");
    }

    log("cameraIdx", cameraIdx, "received streams:", streamCodecs);
    streamCodecs.forEach((s) => {
      connection.addTransceiver(s.Type, { direction: "sendrecv" });
    });
    setupVideoStreamCount = 0;
  } catch (error) {
    log("cameraIdx", cameraIdx, error);
    setupVideoStreamCount += 1;

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await initConnections(connection, cameraIdx, camera);
  }
};

export const setupVideoStream = async (
  connection: RTCPeerConnection,
  cameraIdx: string,
  camera: Camera
) => {
  const stream = new MediaStream();
  setupTrackEventHandler(connection, stream, cameraIdx);
  await initConnections(connection, cameraIdx, camera);
};

export const getCameras = async () => {
  const cameras = await fetchJson(
    `${configs.serverUrl}/store/camera/${storeId}`
  );
  if (!cameras || cameras.length === 0) return null;
  return cameras;
};
