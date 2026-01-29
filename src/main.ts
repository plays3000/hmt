import configs from "@config";
import { initIndexedDB } from "./db/indexedDb.js";
import { initCameraWithWebRTC } from "./htmlElement/initCameraWithWebRTC.js";
import { initWebcam } from "./htmlElement/initWebcam.js";
import { initVideo } from "./htmlElement/initVideo.js";
import { deleteIndexByPeriod } from "./db/indexedDb.js";

export const main = async () => {
  try {
    const isInitIndexedDB = await initIndexedDB();
    if (!isInitIndexedDB) return console.error("can't init indexedDB");

    const retentionPeriodTime = getMidnightTimestamp(
      configs.commonRetentionPeriod
    );
    await deleteIndexByPeriod("hmtFeature", retentionPeriodTime);
    await deleteIndexByPeriod("hmtCropImg", retentionPeriodTime);

    if (configs.camType == "webRTC") {
      await initCameraWithWebRTC();
    } else if (configs.camType == "webcam") {
      await initWebcam();
    } else if (configs.camType == "video") {
      await initVideo();
    }
  } catch (error) {
    console.error(error);
  }
};

const getMidnightTimestamp = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - (daysAgo - 1));
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
