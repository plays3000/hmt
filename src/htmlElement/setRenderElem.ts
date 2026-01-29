import configs from "@config";
import * as tf from "@tensorflow/tfjs";
import { processVideo } from "../hmt/processVideo.js";
import { updateIndexDB } from "../util/util.js";
import { readIndex } from "../db/indexedDb.js";
import { setBackend } from "../util/initTfBackend.js";
import { loadModels } from "../aiModel/loadModels.js";
import {
  RenderElement,
  Performance,
  HmtFeature,
  HmtCropImg,
} from "../types.js";
import cv from "opencv-ts";
import {
  fetchIndexedHmtTrackers,
  fetchIndexedFeatures,
  setRecursiveTimeout,
  healthCheckToGCPLogger,
} from "../util/util.js";

export async function setRenderElem(
  renderElement: RenderElement,
  cameraIdx: string
) {
  const FPS = configs.fps;
  const { video, canvas } = renderElement;
  if (!video) return console.error("can't find video element");
  if (!canvas) return console.error("can't find canvas element");

  while (true) {
    const backendInitialized = await setBackend();
    if (!backendInitialized) {
      console.log(`Backend initialization failed. Retrying...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2));
    } else {
      break;
    }
  }

  let models = await loadModels();
  if (!models) return console.error("can't load models");

  const cap = new cv.VideoCapture(video);
  setTimeout(async () => {
    getMemoryUsage();
    const hmtFeatureMap = new Map<string, HmtFeature>();
    const hmtCropImgMap = new Map<string, HmtCropImg>();
    const hmtFeatures: HmtFeature[] = await readIndex("hmtFeature");
    const hmtCropImgs: HmtCropImg[] = await readIndex("hmtCropImg");
    hmtFeatures.forEach((hmtFeature) => {
      hmtFeatureMap.set(hmtFeature.id!, hmtFeature);
    });
    hmtCropImgs.forEach((hmtCropImg) => {
      hmtCropImgMap.set(hmtCropImg.id!, hmtCropImg);
    });

    let updateCount = 0;
    setInterval(() => {
      updateIndexDB(hmtFeatureMap, hmtCropImgMap);
      updateCount++;
      if (updateCount >= 6) window.location.reload();
    }, 5 * 60 * 1000);

    setRecursiveTimeout(() => fetchIndexedHmtTrackers(), 1000 * 60);
    setRecursiveTimeout(() => fetchIndexedFeatures(hmtFeatureMap), 1000 * 60);
    setRecursiveTimeout(healthCheckToGCPLogger, 1000 * 60 * 10);

    getMemoryUsage();
    setRecursiveTimeout(
      () =>
        processVideo(
          cap,
          hmtFeatureMap,
          hmtCropImgMap,
          video,
          cameraIdx,
          models
        ),
      1000 / FPS
    );
  }, 5000);
}

function getMemoryUsage() {
  const performance = window.performance as Performance;
  if (performance.memory) {
    const used = performance.memory.usedJSHeapSize;
    console.log(`Used JS heap size: ${used} bytes`);
  } else {
    console.log("performance.memory is not supported in this environment.");
  }
}
