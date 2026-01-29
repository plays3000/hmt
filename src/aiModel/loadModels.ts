import configs from "@config";
import * as tf from "@tensorflow/tfjs";
import { Models } from "../types.js";

export async function loadModels(): Promise<Models> {
  const centernet = await tf.loadGraphModel(configs.modelOptions.modelPath);
  const dbface = await tf.loadGraphModel(configs.faceOptions.modelPath);
  const extractor = await tf.loadLayersModel(configs.featureOptions.modelPath);
  // const layer = mobilenet.getLayer("out_relu");
  // const output = tf.layers.flatten().apply(layer.output) as tf.SymbolicTensor;
  // const extractor = tf.model({
  //   inputs: mobilenet.inputs,
  //   outputs: output,
  // });
  const TYYNet = await tf.loadLayersModel(configs.tyyNetOptions.modelPath);
  const lstm = await tf.loadLayersModel("./CNN_LSTM_tfjs_20241112/model.json");
  return { centernet, dbface, extractor, TYYNet, lstm };
}
