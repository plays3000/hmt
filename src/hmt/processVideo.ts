import configs from "@config";
import * as tf from "@tensorflow/tfjs";
import {
  decodeBboxes,
  preProcessImage,
} from "../trackPredict/trackPredictUtil.js";
import {
  updateHmtFeature,
  featureAndCropImgExtract,
} from "../trackPredict/hmtFeature.js";
import { updateCropImg } from "../cropImg/cropImg.js";
import { opencvRender } from "../opencv/opencvRender.js";
import { ulid } from "ulid";
import { saveHmtTrackers } from "../db/indexedDb.js";
import { writeInfo, storeId } from "../util/util.js";
import {
  HmtFeature,
  HmtCropImg,
  Models,
  VideoCapture,
  HmtTracker,
} from "../types.js";
import cv from "opencv-ts";
import { setBackend } from "../util/initTfBackend.js";

const renderSwitch = configs.renderSwitch ?? false;

export async function processVideo(
  cap: VideoCapture,
  hmtFeatureMap: Map<string, HmtFeature>,
  hmtCropImgMap: Map<string, HmtCropImg>,
  video: HTMLVideoElement,
  cameraIdx: string,
  models: Models
) {
  let capturedFrame: tf.Tensor<tf.Rank.R3> | null = null;
  let img: tf.Tensor<tf.Rank.R4> | null = null;
  let imgSrc: tf.Tensor<tf.Rank.R4> | null = null;
  const src = new cv.Mat(480, 640, cv.CV_8UC4);
  const dst = new cv.Mat(480, 640, cv.CV_8UC3);

  try {
    if (!video || video.readyState < 2) return;

    capturedFrame = await captureFrame(video);
    [img, imgSrc] = preProcessImage(capturedFrame);

    // 모델 추론 전에 이전 텐서들이 처리완료되었는지 확인
    await tf.ready();
    const [centers, bboxs] = await decodeBboxes(img, models.centernet);

    // const faceBboxes = await decodeFaceBboxes(dbface, imgSrc);
    // const agesList = predictAge(imgSrc, faceBboxes, TYYNet);
    // for (let i = 0; i < agesList.length; i++){
    //   const maxScore = Math.max(...agesList[i]);
    //   console.log(agesList[i].indexOf(maxScore))
    // }

    const extractMap = featureAndCropImgExtract(
      imgSrc,
      bboxs,
      models.extractor
    );

    const hmtExtractMap = updateHmtFeature(hmtFeatureMap, extractMap);

    updateCropImg(hmtExtractMap, hmtCropImgMap);

    const tracks: HmtTracker[] = [];
    hmtExtractMap.forEach((extractObj) => {
      const track: HmtTracker = {
        id: ulid(),
        storeId,
        deviceId: cameraIdx,
        bbox: extractObj.bbox,
        hmtFeatureId: extractObj.feature.id!,
        createdAt: new Date(),
      };
      tracks.push(track);
    });

    saveHmtTrackers(tracks);

    if (renderSwitch) {
      cap.read(src);
      cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB);
      opencvRender(dst, tracks, cameraIdx);
    } else {
      writeInfo(tracks);
    }
  } catch (e) {
    // WebGPU 재실행
    tf.engine().endScope();
    tf.disposeVariables();
    await setBackend();
  } finally {
    if (capturedFrame) capturedFrame.dispose();
    if (img) img.dispose();
    if (imgSrc) imgSrc.dispose();
    src.delete();
    dst.delete();
  }
}

async function captureFrame(videoElement: HTMLVideoElement) {
  await tf.ready();
  return tf.tidy(() => tf.browser.fromPixels(videoElement));
}
