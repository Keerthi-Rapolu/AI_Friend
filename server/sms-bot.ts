import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import { askLocal } from "../src/llm"; // path is correct

const app = express();

// Twilio posts application/x-www-form-urlencoded by default
app.use(bodyParser.urlencoded({ extended: false }));

app.post("/sms", async (req: Request, res: Response) => {
  const incoming = String((req.body as any).Body || "");
  const reply = await askLocal(incoming, { maxTokens: 80, temperature: 0.7 });

  res.set("Content-Type", "text/xml"); // TwiML
  res.send(`<Response><Message>${reply}</Message></Response>`);
});

app.listen(8081, () => console.log("SMS bot listening :8081"));
