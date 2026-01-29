import * as tf from "@tensorflow/tfjs";
import cv from "opencv-ts";

export type HmtTracker = {
  id?: string;
  storeId: string;
  deviceId: string;
  hmtFeatureId: string;
  bbox: number[];
  createdAt: Date;
};

export type HmtFeature = {
  id?: string;
  storeId: string;
  feature: number[];
  createdAt: Date;
  updatedAt: Date;
};

export type HmtCropImg = {
  id?: string;
  storeId: string;
  cropImgs: number[][];
  createdAt: Date;
  updatedAt: Date;
};

export type Extract = {
  feature: number[];
  bbox: number[];
  cropImg?: number[];
};

export type HmtExtract = {
  feature: HmtFeature;
  bbox: number[];
  cropImg?: number[];
};

export type Camera = {
  ip: string;
  id: string;
  password: string;
  manufacturer: string;
};

export type JCodec = {
  Type: string; // 'video' or 'audio'
};

export type Detection = [number, number];

type VideoCapture = InstanceType<typeof cv.VideoCapture>;

export interface Models {
  centernet: tf.GraphModel<string | tf.io.IOHandler>;
  dbface: tf.GraphModel<string | tf.io.IOHandler>;
  extractor: tf.LayersModel;
  TYYNet: tf.LayersModel;
  lstm: tf.LayersModel;
}

export interface RenderElement {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  canvasForCapture: HTMLCanvasElement;
}

export interface VideoFolder {
  folderName: string;
  videos: string[];
}

export interface Performance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}
