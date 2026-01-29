process.env.OPENCV4NODEJS_DISABLE_EXTERNAL_MEM_TRACKING = "1";
import express from "express";
import { readdirSync, statSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { VideoFolder } from "./types";

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "/public")));
app.use("/node_modules", express.static(path.join(__dirname, "/node_modules")));
app.use(
  "/docs.opencv.org_4.5.0_opencv.js",
  express.static(
    path.join(__dirname, "/public/docs.opencv.org_4.5.0_opencv.js")
  )
);

app.get("/", (req, res) => {
  const filePath = path.join(__dirname, "views", "index.html");
  res.sendFile(filePath);
});

app.get("/videos", (req, res) => {
  const videos = getVideoFolders();
  res.json(videos);
});

app.listen(8080, () => {
  console.log("Server started on http://localhost:8080");
});

function getVideoFolders() {
  const publicPath = path.join(process.cwd(), "public", "videos");
  const videoFolders: VideoFolder[] = [];

  try {
    const items = readdirSync(publicPath);

    const folders = items.filter((item) => {
      const itemPath = path.join(publicPath, item);
      return statSync(itemPath).isDirectory();
    });

    for (const folder of folders) {
      const folderPath = path.join(publicPath, folder);
      const videos = readdirSync(folderPath)
        .filter((file) => /\.(mp4|webm|mov)$/i.test(file))
        .map((file) => path.join("videos", folder, file));
      videoFolders.push({
        folderName: folder,
        videos: videos,
      });
    }

    return videoFolders;
  } catch (error) {
    console.error("Error reading video directories:", error);
    return [];
  }
}
