import configs from "@config";

export const log = (...msg: any[]) => {
  if (configs?.client?.debug) {
    const dt = new Date();
    const ts =
      dt.toTimeString().split(" ")[0] +
      "." +
      dt.getMilliseconds().toString().padStart(3, "0");
    console.log(ts, ...msg);
  }
};
