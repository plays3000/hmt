import { HmtCropImg, HmtExtract, HmtFeature } from "../types.js";
import { storeId } from "../util/util.js";

export function getHmtCropImg(
  id: string,
  cropImgs: number[][],
  createdAt = new Date(),
  updatedAt = new Date()
): HmtCropImg {
  return { id, storeId, cropImgs, createdAt, updatedAt };
}

export function updateCropImg(
  hmtExtractMap: Map<number, HmtExtract>,
  hmtCropImgMap: Map<string, HmtCropImg>
) {
  for (const [_, extractObj] of hmtExtractMap) {
    if (!extractObj.cropImg || !extractObj.feature.id) continue;

    const hmtFeatureId = extractObj.feature.id;
    const cropImg = extractObj.cropImg;

    let currentCropImg = hmtCropImgMap.get(hmtFeatureId);

    if (currentCropImg) {
      if (currentCropImg.cropImgs.length > 19) currentCropImg.cropImgs.shift();
      currentCropImg.cropImgs.push(cropImg);
      currentCropImg.updatedAt = new Date();
    } else {
      currentCropImg = getHmtCropImg(hmtFeatureId, [cropImg]);
    }

    hmtCropImgMap.set(hmtFeatureId, currentCropImg);
  }
}
