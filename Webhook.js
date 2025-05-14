const express = require("express");
const axios = require("axios");
const cors = require("cors"); // أضف هذا
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const ACCESS_TOKEN =
  "EAAa3BG4Yyp4BO5sZAFPAY9G93AByskQj0aAjqdV3opricSZAnKuYBTg9iTCqZCqRNKqKs4IbIhVyzEAgrLZBZCTVBp1zze0GgsXy7KeHOcmDbI13BZBFmkCitUjvE5peHDYz0hwTHvOnma9YQqcUfGp9CFG6lRScdarvVE0RDH3TOJBljMCZAZAozpHBhevGPdZBZCehokt5KYeSmWnP9MlgsXbYxPWrAiIQZDZD"; // ضع التوكن الصحيح هنا
const EASY_ORDERS_API_TOKEN = "24133ac9-6de9-4b77-b3c5-cdd2b8d2c139";
const VERIFY_TOKEN = "easyorders123";

const confirmationCodes = {};
const phoneNumberIds = {};
let currentPhoneNumber = ""; // متغير لتخزين رقم الهاتف الحالي

app.get("/webhook/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully");
    res.status(200).send(challenge);
  } else {
    console.log("Webhook verification failed");
    res.status(403).send("Verification failed");
  }
});

app.get("/current-phone", (req, res) => {
  res.status(200).json({ phone_number: currentPhoneNumber });
});

app.post("/webhook/meta", async (req, res) => {
  try {
    const body = req.body;
    console.log("Received Webhook payload:", JSON.stringify(body, null, 2));

    if (body.object === "whatsapp_business_account") {
      const entry = body.entry[0];
      const change = entry.changes[0];
      const value = change.value;

      console.log("Webhook value:", JSON.stringify(value, null, 2));

      if (
        value.messages &&
        value.messages[0] &&
        value.metadata &&
        value.metadata.phone_number_id
      ) {
        const message = value.messages[0];
        const phoneNumber = message.from;
        const messageText = message.text ? message.text.body : "";
        const phoneNumberId = value.metadata.phone_number_id;
        console.log("=================>" + phoneNumberId);
        console.log("-> Phone Number pure : " + phoneNumber);

        phoneNumberIds[phoneNumber] = phoneNumberId;

        console.log(`Message received from ${phoneNumber}: ${messageText}`);

        if (messageText === "أريد تأكيد الطلب") {
          // تحديث رقم الهاتف الحالي
          currentPhoneNumber = phoneNumber;
          console.log("=><><><><========= " + currentPhoneNumber);
          const confirmationCode = Math.floor(
            100000 + Math.random() * 900000
          ).toString();
          confirmationCodes[phoneNumber] = confirmationCode;

          const messagePayload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "text",
            text: { body: `كود تأكيد طلبك هو: ${confirmationCode}` },
          };

          console.log(
            `Sending confirmation code to ${phoneNumber}: ${confirmationCode}`
          );

          const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
          const response = await axios.post(url, messagePayload, {
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          });

          console.log(
            "Confirmation code sent successfully:",
            JSON.stringify(response.data, null, 2)
          );
        } else {
          console.log(`Message "${messageText}" does not match expected text`);
        }
      } else if (value.statuses && value.statuses[0]) {
        const status = value.statuses[0];
        console.log(
          `Status update: ${status.status} for message ${status.id} to ${status.recipient_id}`
        );
      } else {
        console.log("No valid messages or statuses found in the payload");
      }
    } else {
      console.log("Webhook payload is not from WhatsApp");
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error(
      "Error processing Meta webhook:",
      JSON.stringify(
        error.response ? error.response.data : error.message,
        null,
        2
      )
    );
    res.status(500).send("Error processing webhook");
  }
});

app.post("/webhook/verify", async (req, res) => {
  try {
    console.log("Received verify payload:", req.body);
    const body = req.body || {};
    const { phone_number, entered_code } = body;

    if (!phone_number || !entered_code) {
      return res.status(400).json({
        success: false,
        message: "Missing phone_number or entered_code",
      });
    }

    console.log(confirmationCodes);
    console.log("--------> " + phone_number);
    console.log("-----" + confirmationCodes[phone_number]);

    if (!confirmationCodes[phone_number]) {
      return res.status(400).json({
        success: false,
        message: "No confirmation code found for this phone number",
      });
    }

    if (confirmationCodes[phone_number] === entered_code) {
      console.log("Code verified for", phone_number);
      // جلب phoneNumberId عشان نستخدمه في إرسال الرسالة
      const phoneNumberId = phoneNumberIds[phone_number];
      if (!phoneNumberId) {
        console.error("No phone_number_id found for", phone_number);
        return res.status(500).json({
          success: false,
          message: "Internal error: phone_number_id not found",
        });
      }

      // here we send a normal message with the link in the message , we have to send with this link order details
      const thankYouMessagePayload = {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "text",
        text: {
          body: "تم التأكد من كود التحقق بنجاح، شكرًا لاستخدامك خدمتنا! ابعت تفاصيل طلبك هنا: https://wa.me/201016908760?text=تفاصيل%20طلبي",
        },
      };

      try {
        const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
        const response = await axios.post(url, thankYouMessagePayload, {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        console.log(
          "Thank you message with URL button sent successfully:",
          JSON.stringify(response.data, null, 2)
        );
      } catch (apiError) {
        console.error(
          "WhatsApp API error:",
          JSON.stringify(
            apiError.response ? apiError.response.data : apiError.message,
            null,
            2
          )
        );
        throw new Error("Failed to send thank you message");
      }

      // امسح الكود بعد التحقق الناجح
      delete confirmationCodes[phone_number];
      delete phoneNumberIds[phone_number];

      res
        .status(200)
        .json({ success: true, message: "Code verified successfully" });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid confirmation code" });
    }
  } catch (error) {
    console.error("Error verifying code:", error.message);
    res.status(500).json({ success: false, message: "Error verifying code" });
  }
});

app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
