import "dotenv/config";
import { app } from "./app.js";
import { getDefaultSubmissionStore } from "./db/submissions.js";

const port = Number(process.env.PORT || 3000);
getDefaultSubmissionStore();
app.listen(port, () => {
  console.log(`RaveOrb backend listening on http://localhost:${port}`);
});
