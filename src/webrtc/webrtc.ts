import configs from "@config";
import { log } from "../log/logUtil.js";
import { setupVideoStream } from "./webrtcUtil.js";
import { loggingToGcp } from "../log/gcpLog.js";
import {
  fetchJson,
  setRecursiveTimeout,
  putToGcsUsingSignedUrl,
  storeId,
} from "../util/util.js";
import { Camera } from "../types.js";

// Configuration
let retryConnCount = 0;
let dataChannel: RTCDataChannel;

const setupDataChannel = (connection: RTCPeerConnection, cameraIdx: string) => {
  dataChannel = connection.createDataChannel(cameraIdx, { maxRetransmits: 10 });

  dataChannel.onmessage = (e) =>
    log(
      "cameraIdx",
      cameraIdx,
      "Data channel message:",
      dataChannel.label,
      "payload",
      e.data
    );
  dataChannel.onerror = (e) =>
    log(
      "cameraIdx",
      cameraIdx,
      "Data channel error:",
      dataChannel.label,
      "payload",
      e
    );
  dataChannel.onclose = () =>
    log("cameraIdx", cameraIdx, "Data channel closed");
  dataChannel.onopen = () => {
    log("cameraIdx", cameraIdx, "Data channel opened");
    setRecursiveTimeout(() => dataChannel.send("ping"), 1000);
    setRecursiveTimeout(
      () => putToGcsUsingSignedUrl(cameraIdx),
      1000 * 60 * 10
    );
  };

  dataChannel.addEventListener("error", (e) => {
    console.error(
      "cameraIdx",
      cameraIdx,
      `Data channel error on ${storeId}. ${e}`
    );
    dataChannel = connection.createDataChannel(cameraIdx, {
      maxRetransmits: 10,
    });
  });
};

const createRTCConnection = async (cameraIdx: string) => {
  const connection = new RTCPeerConnection();

  connection.oniceconnectionstatechange = async () => {
    log("cameraIdx", cameraIdx, "connection", connection.iceConnectionState);
    if (
      connection.iceConnectionState === "failed" ||
      connection.iceConnectionState === "disconnected"
    ) {
      log("cameraIdx", cameraIdx, "RTP connection failed, retrying...");
      await retryRTCConnection(connection, cameraIdx);
    }
  };
  connection.onnegotiationneeded = async () =>
    createRtcOffer(connection, cameraIdx);

  return connection;
};

const retryRTCConnection = async (
  connection: RTCPeerConnection,
  cameraIdx: string
) => {
  try {
    if (retryConnCount > 30) {
      loggingToGcp(
        "ERROR",
        `retryRTCConnection attempts failed over 30 MiniPC restart`
      );
      await fetchJson(`${configs.rtcServerUrl}/restart`);
    }
    log("cameraIdx", cameraIdx, "Attempting to reconnect...");
    await createRtcOffer(connection, cameraIdx);
    retryConnCount = 0;
  } catch (error) {
    log("cameraIdx", cameraIdx, "Reconnection failed:", error);
    retryConnCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await retryRTCConnection(connection, cameraIdx);
  }
};

const createRtcOffer = async (
  connection: RTCPeerConnection,
  cameraIdx: string
) => {
  try {
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    const res = await fetch(
      `${configs.rtcServerUrl}/stream/receiver/${cameraIdx}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          cameraIdx,
          data: btoa(connection.localDescription?.sdp || ""),
        }),
      }
    );

    if (!res.ok) {
      throw Error(
        `failed to fetch ${configs.rtcServerUrl}/stream/receiver/${cameraIdx}`
      );
    }

    const data = await res.text();
    if (data.length === 0) {
      log("cameraIdx", cameraIdx, "cannot connect:", configs.rtcServerUrl);
    } else {
      connection.setRemoteDescription(
        new RTCSessionDescription({
          type: "answer",
          sdp: atob(data),
        })
      );
      log("cameraIdx", cameraIdx, "Reconnection successful");
    }
  } catch (error) {
    console.error(error);
  }
};

const webRTC = async (camera: Camera, cameraIdx: string) => {
  log("cameraIdx", cameraIdx, "client starting");
  log(`server: ${configs.rtcServerUrl} stream: ${cameraIdx}`);

  const connection = await createRTCConnection(cameraIdx);
  await setupVideoStream(connection, cameraIdx, camera);
  setupDataChannel(connection, cameraIdx);
};

export default webRTC;
