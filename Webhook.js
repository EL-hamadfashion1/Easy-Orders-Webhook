const express = require("express");
const axios = require("axios");
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

const ACCESS_TOKEN = "YOUR_ACCESS_TOKEN_HERE";
// WhatsApp Business Account ID
const WABA_ID = "YOUR_WHATSAPP_BUSINESS_ACCOUNT_ID";
// Easy Orders API Token
const EASY_ORDERS_API_TOKEN = "YOUR_EASY_ORDERS_API_TOKEN";
// Verify Token (from Meta Webhook settings)
const VERIFY_TOKEN = "YOUR_VERIFY_TOKEN";

// In-memory storage for confirmation codes (use a database in production)
const confirmationCodes = {};
const orderMapping = {}; // Maps phone numbers to order IDs

// Webhook verification endpoint (required by Meta)
app.get("/webhook/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Verification failed");
  }
});

// Webhook endpoint to receive messages from Meta
app.post("/webhook/meta", async (req, res) => {
  try {
    const body = req.body;

    // Check if the request contains WhatsApp messages
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry[0];
      const change = entry.changes[0];
      const value = change.value;

      // Check if it's a message and from WhatsApp
      if (
        value.messages &&
        value.messages[0] &&
        value.metadata &&
        value.metadata.phone_number_id
      ) {
        const message = value.messages[0];
        const phoneNumber = message.from; // Customer's phone number
        const messageText = message.text ? message.text.body : "";

        // Check if the message is "أريد تأكيد طلبي"
        if (messageText === "أريد تأكيد طلبي") {
          // Generate or use your manually created confirmation code
          const confirmationCode = Math.floor(
            100000 + Math.random() * 900000
          ).toString(); // Replace with your manual code logic
          confirmationCodes[phoneNumber] = confirmationCode;

          // Send the confirmation code
          const messagePayload = {
            messaging_product: "whatsapp",
            to: phoneNumber,
            type: "text",
            text: {
              body: `كود تأكيد طلبك هو: ${confirmationCode}`,
            },
          };

          await axios.post(
            `https://graph.facebook.com/v20.0/${WABA_ID}/messages`,
            messagePayload,
            {
              headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
              },
            }
          );

          console.log(
            `Confirmation code sent to ${phoneNumber}: ${confirmationCode}`
          );
        }
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    console.error(
      "Error processing Meta webhook:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Error processing webhook");
  }
});

// Endpoint to verify the confirmation code and send order details
app.post("/webhook/verify", async (req, res) => {
  try {
    const { phone_number, entered_code, order_id } = req.body;

    // Check if the entered code matches the stored code
    if (
      confirmationCodes[phone_number] &&
      confirmationCodes[phone_number] === entered_code
    ) {
      // Code is correct, fetch order details from Easy Orders API
      const orderResponse = await axios.get(
        `https://api.easy-orders.net/v1/orders/${order_id}`,
        {
          headers: {
            Authorization: `Bearer ${EASY_ORDERS_API_TOKEN}`,
          },
        }
      );

      const orderDetails = orderResponse.data;
      const orderMessage =
        `تفاصيل طلبك رقم #${order_id}:\n` +
        `المنتجات: ${
          orderDetails.items.map((item) => item.name).join(", ") || "غير متوفر"
        }\n` +
        `السعر: ${orderDetails.total || "غير متوفر"} SAR\n` +
        `شكرًا لاختيارك لنا!`;

      // Send the order details via WhatsApp API
      const messagePayload = {
        messaging_product: "whatsapp",
        to: phone_number,
        type: "text",
        text: {
          body: orderMessage,
        },
      };

      await axios.post(
        `https://graph.facebook.com/v20.0/${WABA_ID}/messages`,
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`Order details sent to ${phone_number}`);

      // Remove the code after successful verification
      delete confirmationCodes[phone_number];

      res.status(200).json({
        success: true,
        message: "Code verified and order details sent",
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid confirmation code" });
    }
  } catch (error) {
    console.error(
      "Error verifying code:",
      error.response ? error.response.data : error.message
    );
    res.status(500).send("Error verifying code");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
