import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgpu";
import "@tensorflow/tfjs-backend-webgl";

export async function setBackend() {
  try {
    if ("gpu" in navigator) {
      await tf.setBackend("webgpu");
      await tf.ready();
      // 실제로 백엔드가 설정되었는지 확인
      const currentBackend = tf.getBackend();
      if (currentBackend !== "webgpu") {
        throw new Error("WebGPU backend not properly initialized");
      }
      console.log("Using WebGPU backend");
      return true;
    } else {
      await tf.setBackend("webgl");
      await tf.ready();
      const currentBackend = tf.getBackend();
      if (currentBackend !== "webgl") {
        throw new Error("WebGL backend not properly initialized");
      }
      console.log("Using WebGL backend");
      return true;
    }
  } catch (error) {
    console.error("Failed to set backend:", error);
  }
}
