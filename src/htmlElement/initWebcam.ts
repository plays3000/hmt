import { createVideoCanvasElements } from "./createHTMLElements.js";
import { setRenderElem } from "./setRenderElem.js";

export async function initWebcam() {
  const renderElements = [];

  const elements = createVideoCanvasElements("0");
  renderElements.push(elements);

  const video = elements.video;

  if (navigator.mediaDevices.getUserMedia) {
    const constraints = { audio: false, video: { width: 640, height: 480 } };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(async (stream) => {
        video.srcObject = stream;
        await video.play();
      })
      .catch(function (error) {
        console.log(error);
        return;
      });
  }

  setRenderElem(elements, "0");

  return renderElements;
}
