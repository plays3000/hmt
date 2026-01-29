import configs from "@config";
import { getGaussianKernel, blur } from "./gaussianBlur.js";
import { labels } from "./labels.js";
import * as tf from "@tensorflow/tfjs";

export function bbox_xyxy(bbox_xywh: number[][]) {
  return bbox_xywh.map((b) => {
    return [b[0], b[1], b[0] + b[2], b[1] + b[3]];
  });
}

async function processResults(res: tf.Tensor<tf.Rank.R3>) {
  const reshape = configs.reshape;
  const imgInputShape = configs.imgInputShape;
  const modelOptions = configs.modelOptions;

  let detections: number[][][] | null = null;
  let stackT: tf.Tensor<tf.Rank> | null = null;
  let boxesT: tf.Tensor2D | null = null;
  let scoresT: tf.Tensor1D | null = null;
  let nmsT: tf.Tensor1D | null = null;

  try {
    detections = await res.array();

    [stackT!, boxesT!, scoresT!] = tf.tidy(() => {
      const squeezeT = tf.squeeze<tf.Tensor2D>(res);
      const arr = tf.split<tf.Tensor2D>(squeezeT, 6, 1);
      const stackT = tf.stack<tf.Tensor2D>([arr[1], arr[0], arr[3], arr[2]], 1);
      const boxesT = stackT.squeeze<tf.Tensor2D>();
      const scoresT = arr[4].squeeze<tf.Tensor1D>();
      squeezeT.dispose();
      return [stackT, boxesT, scoresT];
    });

    nmsT = await tf.image.nonMaxSuppressionAsync(
      boxesT,
      scoresT,
      modelOptions.maxResults,
      modelOptions.iouThreshold,
      modelOptions.minScore
    );

    const nms = await nmsT.data();
    const results: Array<{
      id: number;
      score: number;
      class: number;
      label: string;
      box: number[];
      boxRaw: number[];
    }> = [];

    for (const id of nms) {
      const score = detections[0][id][4];
      const classVal = detections[0][id][5];
      const label = labels[classVal].label;
      const [x, y] = [
        detections[0][id][0] / reshape,
        detections[0][id][1] / reshape,
      ];
      const boxRaw = [
        x,
        y,
        detections[0][id][2] / reshape,
        detections[0][id][3] / reshape,
      ];
      const box = [
        Math.trunc(boxRaw[0] * imgInputShape[0]),
        Math.trunc(boxRaw[1] * imgInputShape[1]),
        Math.trunc(boxRaw[2] * imgInputShape[0]),
        Math.trunc(boxRaw[3] * imgInputShape[1]),
      ];

      results.push({ id, score, class: classVal, label, box, boxRaw });
    }
    return results;
  } finally {
    if (res) res.dispose();
    if (stackT) stackT.dispose();
    if (boxesT) boxesT.dispose();
    if (scoresT) scoresT.dispose();
    if (nmsT) nmsT.dispose();
    await tf.ready();
  }
}

function calculateCenterPoints(bbox: number[][]) {
  return bbox.map((x) => {
    return [x[0] + x[2] / 2, x[1] + x[3] / 2];
  });
}

export function bbox_xywh(bbox_raw2: number[][]) {
  return bbox_raw2.map((b) => {
    const x1 = b[0] * configs.imgInputShape[1];
    const y1 = b[1] * configs.imgInputShape[0];
    const x = Math.max(Math.floor(x1), 0);
    const y = Math.max(Math.floor(y1), 0);
    const w = Math.floor(b[2] * configs.imgInputShape[1]);
    const h = Math.floor(b[3] * configs.imgInputShape[0]);
    return [x, y, w, h];
  });
}

export function preProcessImage(src: tf.Tensor<tf.Rank.R3>) {
  const cap = configs.preprocessSwitch ? preprocessing(src, 0.3, 0.7, 2) : src;
  const [img1, imgSrc] = tf.tidy(() => {
    const imgSrc = tf.expandDims<tf.Tensor4D>(cap, 0);
    const img1 = tf.cast(
      tf.image.resizeBilinear(imgSrc, [configs.reshape, configs.reshape]),
      "float32"
    );
    return [img1, imgSrc];
  });
  return [img1, imgSrc];
}

async function predictCenternet(
  img: tf.Tensor<tf.Rank.R4>,
  centernet: tf.GraphModel<string | tf.io.IOHandler>
) {
  const res = centernet.execute(img, [
    "tower_0/detections",
  ]) as tf.Tensor<tf.Rank.R3>; //1:bbox  2:class 4:score
  const result = await processResults(res);
  const detect = result.filter((x) => {
    return x.score > 0.3 && x.class === 0;
  });
  const bbox2 = [];

  for (let d of detect) {
    bbox2.push(d.boxRaw);
  }
  if (bbox2.length != 0) {
    // bbox = await bbox_xywh(device, bbox);
    const bbox_result = bbox_xywh(bbox2);
    // bbox = bbox.map((b)=>{return [parseInt(b[0]),parseInt(b[1]),parseInt(b[2]),parseInt(b[3])]})
    res.dispose();
    if (img) img.dispose();
    return bbox_result;
  } else {
    res.dispose();
    if (img) img.dispose();
    return [];
  }
}

export async function decodeBboxes(
  img: tf.Tensor4D,
  centernet: tf.GraphModel<string | tf.io.IOHandler>
) {
  try {
    const centernet_bbox = await predictCenternet(img, centernet);
    if (centernet_bbox.length === 0) return [[], []];
    const center = calculateCenterPoints(centernet_bbox);
    return [center, centernet_bbox];
  } finally {
    if (img) img.dispose();
    await tf.ready();
  }
}

export async function decodeFaceBboxes(
  model: tf.GraphModel<string | tf.io.IOHandler>,
  img: tf.Tensor4D
) {
  const imgInputShape = configs.imgInputShape;
  const faceOptions = configs.faceOptions;
  // const regionLandmarks = ['eyeRight', 'eyeLeft', 'nose', 'mouthRight', 'mouthLeft'];
  const { tensorBoxes, scoreMask } = tf.tidy(() => {
    const [boxT, scoreT, landmarkT] = model.execute(img) as [
      tf.Tensor<tf.Rank.R3>,
      tf.Tensor<tf.Rank.R3>,
      tf.Tensor<tf.Rank.R3>
    ];
    const strideX = scoreT.shape[2];
    const strideY = scoreT.shape[1];
    const score1D = scoreT.dataSync();
    const scoreMask = tf.greaterEqual<tf.Tensor1D>(score1D, 0.4);
    const boxRaw = boxT.reshape<tf.Tensor1D>([-1]).arraySync(); // [120, 160, 4]
    boxT.dispose();
    scoreT.dispose();
    landmarkT.dispose();

    const boxes = [];
    for (let y = 0; y < strideY; y++) {
      //120
      for (let x = 0; x < strideX; x++) {
        //160
        const idx = y * strideX + x;
        const x0 = (x - boxRaw[4 * idx + 0]) / strideX;
        const y0 = (y - boxRaw[4 * idx + 1]) / strideY;
        const x1 = (x + boxRaw[4 * idx + 2]) / strideX;
        const y1 = (y + boxRaw[4 * idx + 3]) / strideY;
        boxes.push([x0, y0, x1 - x0, y1 - y0]);
      }
    }
    const tensorBoxes = tf.tensor2d(boxes);
    return { tensorBoxes, scoreMask };
  });

  const selectedBoxesT = (await tf.booleanMaskAsync(
    tensorBoxes,
    scoreMask
  )) as tf.Tensor<tf.Rank.R2>;
  const selectedBoxes = tf.tidy(() => {
    return selectedBoxesT.arraySync();
  });
  const nmsRegions = await nms(
    selectedBoxes,
    faceOptions.iouThreshold,
    faceOptions.maxResults
  );

  let results = [];
  for (let reg of nmsRegions) {
    let x = reg[0] * imgInputShape[0];
    let y = reg[1] * imgInputShape[1];
    let w = reg[2] * imgInputShape[0];
    let h = reg[3] * imgInputShape[1];
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > imgInputShape[0]) w = imgInputShape[0] - x;
    if (y + h > imgInputShape[1]) h = imgInputShape[1] - y;
    results.push([x, y, w, h]);
  }

  // let results = await bbox_resize(device, nmsRegions)
  scoreMask.dispose();
  tensorBoxes.dispose();
  selectedBoxesT.dispose();
  if (img) img.dispose();

  return results;
}

export function predictAge(
  img: tf.Tensor4D,
  faceBboxes: number[][],
  TYYNet: tf.GraphModel<string | tf.io.IOHandler>
) {
  const imgInputShape = configs.imgInputShape;

  const agesList = [];
  if (faceBboxes.length != 0) {
    for (let fb of faceBboxes) {
      let x = fb[0] > 0 ? fb[0] : 0;
      if (x > imgInputShape[0]) x = imgInputShape[0];

      let y = fb[1] > 0 ? fb[1] : 0;
      if (y > imgInputShape[1]) y = imgInputShape[1];

      let w =
        x + fb[2] < imgInputShape[0] ? fb[2] : Math.abs(imgInputShape[0] - x);
      let h =
        y + fb[3] < imgInputShape[1] ? fb[3] : Math.abs(imgInputShape[1] - y);
      const age = tf.tidy(() => {
        const sliced = tf.slice(img, [0, y, x, 0], [1, h, w, 3]);
        const cap2 = tf.image.resizeBilinear(sliced, [224, 224]);
        const result = TYYNet.predict(cap2) as tf.Tensor<tf.Rank.R2>;
        const resultArr = result.arraySync()[0];
        cap2.dispose();
        sliced.dispose();
        result.dispose();
        return resultArr;
      });
      agesList.push(age);
    }
  }

  if (img) img.dispose();

  return agesList;
}

export function preprocessing(
  cap: tf.Tensor<tf.Rank.R3>,
  alpha: number,
  beta: number,
  gamma: number
) {
  let src, g_kernel, blurred, add;
  try {
    src = tf.tidy(() => tf.cast<tf.Tensor<tf.Rank.R3>>(cap, "float32"));
    g_kernel = getGaussianKernel(1, 9);
    blurred = blur(src, g_kernel);
    add = tf.add(
      tf.add(tf.mul(src, tf.scalar(alpha)), tf.mul(blurred, tf.scalar(beta))),
      tf.scalar(gamma)
    );
    return add;
  } finally {
    if (src) src.dispose();
    if (blurred) blurred.dispose();
    if (g_kernel) g_kernel.dispose();
  }
}

//==============================================================================================
function bbox_area(bboxesT : tf.Tensor2D){  //bbox = [x,y,w,h]
  const area = tf.tidy(()=>{

    const ws : tf.Tensor2D= bboxesT.slice([0,2],[-1,1]);
    const hs : tf.Tensor2D = bboxesT.slice([0,3],[-1,1]);
    tf.engine().endScope();
    return tf.mul(ws, hs);
  });
  
  return area;
}

export function iou_tensor(bboxes1 : number[][], bboxes2 : number[][]) : number[][]{
  tf.engine().startScope();
  const bboxes1T: tf.Tensor2D = tf.tensor(bboxes1);
  const bboxes2T: tf.Tensor2D = tf.tensor(bboxes2);

  const area1 = bbox_area(bboxes1T);
  const area2 = bbox_area(bboxes2T);

  const bboxes1_lt = tf.expandDims(bboxes1T, 1).slice([0,0,0], [-1,-1, 2]) as  tf.Tensor3D;
  const bboxes1_rb = tf.expandDims(bboxes1T, 1).slice([0,0,2], [-1,-1, 2]) as tf.Tensor3D;
  const bboxes2_lt = bboxes2T.slice([0, 0], [-1, 2]);
  const bboxes2_rb = bboxes2T.slice([0, 2], [-1, 2]);
  const lt = tf.maximum(bboxes1_lt, bboxes2_lt);
  const rb = tf.minimum(bboxes1_rb, bboxes2_rb);

  const wh : tf.Tensor3D = tf.maximum(tf.sub(rb, lt), 0);   // [N, M, 2]
  const w = tf.squeeze(wh.slice([0,0,0],[-1,-1,1]));
  const h = tf.squeeze(wh.slice([0,0,1],[-1,-1,1]));
  const inter = tf.mul(w,h);
  const union = tf.expandDims(area1,1).add(area2).sub(inter);

  const iou = inter.div(union);
  const iouArr = iou.arraySync();
  tf.engine().endScope();
  return iouArr;
}
export function iou(region0: number[], region1: number[]) {
  const [sx0, sy0, w0, h0] = region0;
  const [sx1, sy1, w1, h1] = region1;

  const ex0 = w0 + sx0;
  const ey0 = h0 + sy0;
  const ex1 = w1 + sx1;
  const ey1 = h1 + sy1;

  const xmin0 = Math.min(sx0, ex0);
  const ymin0 = Math.min(sy0, ey0);
  const xmax0 = Math.max(sx0, ex0);
  const ymax0 = Math.max(sy0, ey0);
  const xmin1 = Math.min(sx1, ex1);
  const ymin1 = Math.min(sy1, ey1);
  const xmax1 = Math.max(sx1, ex1);
  const ymax1 = Math.max(sy1, ey1);
  const area0 = (ymax0 - ymin0) * (xmax0 - xmin0);
  const area1 = (ymax1 - ymin1) * (xmax1 - xmin1);
  if (area0 <= 0 || area1 <= 0) return 0.0;
  const ymax_max = Math.max(
    Math.min(ymax0, ymax1) - Math.max(ymin0, ymin1),
    0.0
  );
  const xmax_max = Math.max(
    Math.min(xmax0, xmax1) - Math.max(xmin0, xmin1),
    0.0
  );
  const intersectArea = ymax_max * xmax_max;
  const result = intersectArea / (area0 + area1 - intersectArea);
  return result;
}

export async function nms(
  regions: number[][],
  iouThreshold: number,
  maxResults: number
) {
  const nmsRegions = [];
  for (let i = 0; i < regions.length; i++) {
    let ignore = false;
    for (let j = 0; j < nmsRegions.length; j++) {
      if (iou(regions[i], nmsRegions[j]) >= iouThreshold) {
        ignore = true;
        break;
      }
    }
    if (!ignore) {
      nmsRegions.push(regions[i]);
      if (nmsRegions.length >= maxResults) break;
    }
  }
  return nmsRegions;
}
