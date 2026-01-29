import configs from "@config";
import { loggingToGcp } from "../log/gcpLog.js";
import { log } from "../log/logUtil.js";
import {
  saveHmtFeature,
  saveHmtCropImg,
  saveHmtTrackers,
  deleteIndex,
} from "../db/indexedDb.js";
import { HmtTracker, HmtFeature, HmtCropImg } from "../types.js";

const searchParams = new URLSearchParams(window.location.search);
export const storeId =
  searchParams.get("storeId") || "66a2e817160c5c834c792db3";

export const fetchIndexedHmtTrackers = async () => {
  const trackers: HmtTracker[] = await deleteIndex("hmtTracker");
  fetchHmtTrackers(trackers)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
    })
    .catch((error) => {
      loggingToGcp("ERROR", `Error during fetch hmt: ${error}`);
      saveHmtTrackers(trackers);
    });
};

export const fetchIndexedFeatures = async (
  hmtFeatureMap: Map<string, HmtFeature>
) => {
  const oneMinuteAgo = Date.now() - 1000 * 60;
  const hmtFeatures: HmtFeature[] = [];
  for (const feature of hmtFeatureMap.values()) {
    if (feature.createdAt.getTime() < oneMinuteAgo) continue;
    hmtFeatures.push(feature);
  }
  if (hmtFeatures.length < 1) return;
  fetchHmtFeatures(hmtFeatures)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
    })
    .catch((error) => {
      loggingToGcp("ERROR", `Error during fetch hmt: ${error}`);
    });
};

const fetchHmtTrackers = async (hmtTrackers: HmtTracker[]) => {
  return fetch(`${configs.serverUrl}/hmt/tracker/${storeId}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(hmtTrackers),
  });
};

const fetchHmtFeatures = async (hmtFeatures: HmtFeature[]) => {
  return fetch(`${configs.serverUrl}/hmt/feature/${storeId}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(hmtFeatures),
  });
};

export async function healthCheckToGCPLogger() {
  try {
    loggingToGcp("INFO", "healthCheck");
  } catch (error) {
    loggingToGcp("ERROR", `Error during health check: ${error}`);
  }
}

export const fetchJson = async (url: string, options = {}) => {
  try {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    log(`Failed to fetch JSON from ${url}: ${res.status}`);
  } catch (error: any) {
    log(`Error fetching JSON from ${url}: ${error.message}`);
  }
  return null;
};

export const writeInfo = (tracks: HmtTracker[]) => {
  const divForInfo = document.getElementById("divForInfo");
  if (!divForInfo) return;
  divForInfo.innerHTML = ""; // 기존 내용을 초기화
  const titleDiv = document.createElement("div");
  titleDiv.innerText = "detected IDs";
  titleDiv.style.fontSize = "36px";
  titleDiv.style.fontWeight = "bold";
  divForInfo.appendChild(titleDiv);
  tracks.forEach((track) => {
    const tracIdDiv = document.createElement("div");
    tracIdDiv.innerText = track.hmtFeatureId!.slice(-6);
    tracIdDiv.style.fontSize = "30px";
    divForInfo.appendChild(tracIdDiv);
  });
};

const getDataUrlFromVideo = (cameraIdx: string) => {
  const video = document.getElementById(
    `video${cameraIdx}`
  ) as HTMLVideoElement;
  const canvas = document.getElementById(
    `canvasForCapture${cameraIdx}`
  ) as HTMLCanvasElement;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context?.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageUrl = canvas?.toDataURL("image/png");
  return imageUrl;
};

const dataURItoBlob = (dataURI: string) => {
  // Split the DataURI to get the base64 part and the content type
  const byteString = atob(dataURI.split(",")[1]);
  const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];

  // Write the bytes of the string to a typed array
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const intArray = new Uint8Array(arrayBuffer);
  for (let i = 0; i < byteString.length; i++) {
    intArray[i] = byteString.charCodeAt(i);
  }

  // Create a Blob from the array buffer
  return new Blob([intArray], { type: mimeString });
};

export const putToGcsUsingSignedUrl = async (cameraIdx: string) => {
  try {
    const response = await fetch(
      `${configs.rtcServerUrl}/signedURL/${cameraIdx}`
    );

    const data = await response.json();

    const dataURI = getDataUrlFromVideo(cameraIdx);
    const blob = dataURItoBlob(dataURI);

    const uploadResponse = await fetch(data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": blob.type },
      body: blob,
    });

    if (!uploadResponse.ok) {
      loggingToGcp("ERROR", "Failed to upload env image");
    }
  } catch (error) {
    log("Error uploading image:", error);
    loggingToGcp("ERROR", `Failed to upload env image. ${error}`);
  }
};

export const setRecursiveTimeout = (fn: () => void, time: number) => {
  const wrappedFn = () => {
    try {
      fn(); // 실제로 fn을 호출합니다.
    } catch (error) {
      log("setRecursiveTimeout", fn, "Error:", error);
    }
    setTimeout(wrappedFn, time); // 재귀 호출을 설정합니다.
  };

  setTimeout(wrappedFn, time);
};

export function updateIndexDB(
  hmtFeatureMap: Map<string, HmtFeature>,
  hmtCropImgMap: Map<string, HmtCropImg>
) {
  for (const hmtFeature of hmtFeatureMap.values()) saveHmtFeature(hmtFeature);
  for (const hmtCropImg of hmtCropImgMap.values()) saveHmtCropImg(hmtCropImg);
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
