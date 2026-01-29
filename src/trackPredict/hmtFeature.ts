import configs from "@config";
import * as tf from "@tensorflow/tfjs";
import { ulid } from "ulid";
import munkres from "munkres";
import { storeId } from "../util/util.js";
import { HmtFeature, HmtExtract, Extract } from "../types.js";

function getHmtFeature(
  id: string,
  feature: number[],
  createdAt = new Date(),
  updatedAt = new Date()
): HmtFeature {
  return { id, storeId, feature, createdAt, updatedAt };
}

export function updateHmtFeature(
  hmtFeatureMap: Map<string, HmtFeature>,
  extractMap: Map<number, Extract>
) {
  const hmtExtractMap: Map<number, HmtExtract> = new Map();

  if (hmtFeatureMap.size == 0) {
    for (const [idx, extractObj] of extractMap) {
      const id = ulid();
      const hmtFeature = getHmtFeature(id, extractObj.feature);
      hmtFeatureMap.set(id, hmtFeature);
      const hmtExtractObj: HmtExtract = {
        feature: hmtFeature,
        bbox: extractObj.bbox,
      };
      if (extractObj.cropImg) hmtExtractObj.cropImg = extractObj.cropImg;
      hmtExtractMap.set(idx, hmtExtractObj);
    }
    return hmtExtractMap;
  }

  tf.engine().startScope();
  const costs = tf.tidy(() => {
    const hmtFeatureArray = Array.from(hmtFeatureMap.values()).map(
      (f) => f.feature
    );
    const extractFeatureArray = Array.from(extractMap.values()).map(
      (e) => e.feature
    );

    const featureLength = hmtFeatureArray[0].length;
    const hmtTensor = tf.tensor2d(hmtFeatureArray, [
      hmtFeatureArray.length,
      featureLength,
    ]);
    const extractTensor = tf.tensor2d(extractFeatureArray, [
      extractFeatureArray.length,
      featureLength,
    ]);

    const dot = tf.matMul(hmtTensor, extractTensor.transpose());
    const hmtNorm = tf.norm(hmtTensor, 2, 1, true);
    const extractNorm = tf.norm(extractTensor, 2, 1, true);
    const normMatrix = tf.matMul(hmtNorm, extractNorm.transpose());

    const similarities = tf.div(dot, normMatrix);
    return tf.sub<tf.Tensor<tf.Rank.R2>>(1, similarities).arraySync();
  });

  if (costs.length === 1 && costs[0][0] > configs.threshold) {
    const id = ulid();
    const hmtFeature = getHmtFeature(id, extractMap.get(0)!.feature);
    const oldFeatureId = Array.from(hmtFeatureMap.keys())[0];
    hmtFeatureMap.delete(oldFeatureId);
    hmtFeatureMap.set(id, hmtFeature);

    hmtExtractMap.set(0, {
      feature: hmtFeature,
      cropImg: extractMap.get(0)!.cropImg,
      bbox: extractMap.get(0)!.bbox,
    });
    return hmtExtractMap;
  }

  const hungarianResults = munkres(costs);
  const hmtFeatureArray = Array.from(hmtFeatureMap.values());
  const hmtFeatureKeys = Array.from(hmtFeatureMap.keys());

  hungarianResults.forEach(([row, col]) => {
    const extractObj = extractMap.get(col);
    if (costs[row][col] < configs.threshold) {
      const currentFeature = hmtFeatureArray[row];
      currentFeature.feature = extractObj!.feature;
      currentFeature.updatedAt = new Date();
      hmtFeatureMap.set(hmtFeatureKeys[row], currentFeature);

      hmtExtractMap.set(col, {
        feature: currentFeature,
        cropImg: extractObj!.cropImg,
        bbox: extractObj!.bbox,
      });
    } else {
      const hmtFeatureId = ulid();
      const hmtFeature = getHmtFeature(hmtFeatureId, extractObj!.feature);
      hmtFeatureMap.set(hmtFeatureId, hmtFeature);
      hmtExtractMap.set(col, {
        feature: hmtFeature,
        cropImg: extractObj!.cropImg,
        bbox: extractObj!.bbox,
      });
    }
  });
  tf.engine().endScope();

  return hmtExtractMap;
}

export function featureAndCropImgExtract(
  img: tf.Tensor<tf.Rank.R4>,
  faceBboxes: number[][],
  extractor: tf.LayersModel
) {
  const imgInputShape = configs.imgInputShape;
  tf.engine().startScope();
  const extractMap = new Map();
  if (faceBboxes.length !== 0) {
    let idx = 0;
    for (const fb of faceBboxes) {
      const xVal = fb[0];
      const yVal = fb[1];
      const wVal = fb[2];
      const hVal = fb[3];

      const x = Math.min(Math.max(xVal, 0), imgInputShape[0]);
      const y = Math.min(Math.max(yVal, 0), imgInputShape[1]);
      const w = Math.min(wVal, imgInputShape[0] - x);
      const h = Math.min(hVal, imgInputShape[1] - y);

      tf.tidy(() => {
        const sliced = tf.slice(img, [0, y, x, 0], [1, h, w, 3]);
        const cap2 = tf.image.resizeBilinear(sliced, [256, 128]);

        const normalizedSlice = tf.mul(cap2, 255);
        const uint8Slice = tf.cast(normalizedSlice, "int32");
        const slicedArr = new Uint8Array(tf.squeeze(uint8Slice).dataSync());

        const predictRes = extractor.predict(cap2) as tf.Tensor<tf.Rank.R1>;
        const featureArr = predictRes.flatten().arraySync();

        if (featureArr && fb && slicedArr) {
          extractMap.set(idx, {
            feature: featureArr,
            cropImg: slicedArr,
            bbox: fb,
          });
        }
      });
      idx++;
    }
  }
  tf.engine().endScope();
  return extractMap;
}

function cosineSimilarity(x: number[], y: number[]) {
  const dot = tf.dot(x, y);
  const normX = tf.norm(x, 2);
  const normY = tf.norm(y, 2);
  const diff = tf.mul(normX, normY);
  const sim = tf.div(dot, diff);
  const simArr = sim.arraySync() as number;
  dot.dispose();
  normX.dispose();
  normY.dispose();
  diff.dispose();
  sim.dispose();
  return 1 - simArr;
}

// 피어슨 상관 계수를 계산하는 함수
function pearsonCorrelation(vecA: number[], vecB: number[]) {
  const correlation = tf.tidy(() => {
    const meanA = tf.mean(vecA);
    const meanB = tf.mean(vecB);

    const diffA = tf.sub(vecA, meanA);
    const diffB = tf.sub(vecB, meanB);

    const numerator = tf.sum(tf.mul(diffA, diffB));

    const denominator = tf.mul(
      tf.sqrt(tf.sum(tf.square(diffA))),
      tf.sqrt(tf.sum(tf.square(diffB)))
    );

    const correlation = tf.div(numerator, denominator);
    const correlationArr = correlation.dataSync()[0];
    correlation.dispose();
    meanA.dispose();
    meanB.dispose();
    diffA.dispose();
    diffB.dispose();
    return correlationArr;
  });

  const rescale = 1 - Math.abs(correlation);

  return rescale;
}
