import { createVideoCanvasElements } from "./createHTMLElements.js";
import { setRenderElem } from "./setRenderElem.js";

export async function initVideo() {
  const renderElements = [];

  const elements = createVideoCanvasElements("0");
  elements.video.src = "thief.mp4";
  renderElements.push(elements);
  setRenderElem(elements, "0");

  // TODO: 서버에서 비디오 폴더 가져오기
  // const response = await fetch("/videos");
  // const videoFolders = await responseon();
  // videoFolders.forEach((videoFolder, idx) => {
  //   const cameraIdx = idx.toString();
  //   const elements = createVideoCanvasElements(
  //     cameraIdx,
  //     videoFolder.videos[0]
  //   );
  //   renderElements.push(elements);
  //   (elements, cameraIdx);
  // });

  return renderElements;
}
