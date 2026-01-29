import { addGcpLogIndex } from "../db/indexedDb.js";
import { storeId } from "../util/util.js";

export const loggingToGcp = async (severity: string, message: string) => {
  try {
    await fetch(
      `https://asia-northeast3-meerzter-ai-developer.cloudfunctions.net/mini-pc-hmt-logging-function/logging`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          severity,
          storeId,
          message,
        }),
      }
    );
  } catch (e) {
    console.error(`Error during loggingToGcp: ${e}`);
    addGcpLogIndex(severity, storeId, message);
  }
};
