const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const ACCESS_TOKEN =
  "EAAa3BG4Yyp4BO6boZBAXQoLIvHGqkAbTn84ID6PjYXMNJvFNP9zCPhRjgxVwpmIChvilAKj0w3LfUTYw0OFZBpo3tOCsTFWtWXbhahREP95i6Tn92ZBO7ZB1G4Gpk6PcBH3O84X8kPa4evXR1pNPgtbHLtRccGpKVi8SR3Y4g7ZA7H3GhgCgjIYdB";
const EASY_ORDERS_API_TOKEN = "24133ac9-6de9-4b77-b3c5-cdd2b8d2c139";
const VERIFY_TOKEN = "easyorders123";

const confirmationCodes = {};
const phoneNumberIds = {};
let currentPhoneNumber = "";

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
            1000 + Math.random() * 9000
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

      // // here we send a normal message with the link in the message , we have to send with this link order details
      // const thankYouMessagePayload = {
      //   messaging_product: "whatsapp",
      //   to: phone_number,
      //   type: "text",
      //   text: {
      //     body: "تم التأكد من كود التحقق بنجاح، شكرًا لاستخدامك خدمتنا! ابعت تفاصيل طلبك هنا: https://wa.me/201016908760?text=تفاصيل%20طلبي",
      //   },
      // };

      // try {
      //   const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
      //   const response = await axios.post(url, thankYouMessagePayload, {
      //     headers: {
      //       Authorization: `Bearer ${ACCESS_TOKEN}`,
      //       "Content-Type": "application/json",
      //     },
      //   });

      //   console.log(
      //     "Thank you message with URL button sent successfully:",
      //     JSON.stringify(response.data, null, 2)
      //   );
      // } catch (apiError) {
      //   console.error(
      //     "WhatsApp API error:",
      //     JSON.stringify(
      //       apiError.response ? apiError.response.data : apiError.message,
      //       null,
      //       2
      //     )
      //   );
      //   throw new Error("Failed to send thank you message");
      // }

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

// Endpoint جديدة لاستقبال حدث order created من EasyOrders
app.post("/webhook/easy-orders", async (req, res) => {
  try {
    const body = req.body;
    console.log(
      "Received EasyOrders webhook payload:",
      JSON.stringify(body, null, 2)
    );

    // التأكد من وجود الـbody
    if (!body) {
      console.error("No body provided in the request");
      return res
        .status(400)
        .json({ success: false, message: "Request body is missing" });
    }

    const {
      phone,
      phone_alt,
      full_name,
      address,
      government,
      cost,
      shipping_cost,
      total_cost,
      cart_items,
      country,
    } = body;

    // التحقق من الحقول الأساسية
    const missingFields = [];
    if (!phone) missingFields.push("phone");
    if (!cart_items || !cart_items.length) missingFields.push("cart_items");

    if (missingFields.length > 0) {
      console.error(`Missing required fields: ${missingFields.join(", ")}`);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // التحقق من الحقول الإضافية المستخدمة في الرسالة
    if (!full_name) console.warn("full_name is missing, using default value");
    if (!address) console.warn("address is missing, using default value");
    if (!government) console.warn("government is missing, using default value");
    if (cost === undefined || cost === null)
      console.warn("cost is missing, using default value");
    if (total_cost === undefined || total_cost === null)
      console.warn("total_cost is missing, using default value");

    // بناء تفاصيل المنتجات
    let itemsDetails = "";
    let totalQuantity = 0; // لحساب إجمالي عدد القطع
    let itemsDetailsForUrl = []; // لتخزين تفاصيل المنتجات للـURL
    cart_items.forEach((item, index) => {
      const productName = item?.product?.name || "منتج غير معروف";
      const quantity = item?.quantity || 1;
      const price = item?.price || 0;

      // استخراج اللون والمقاس إن وجدوا مع تصحيح البحث
      const variantProps = item?.variant?.variation_props || [];
      const color =
        variantProps.find((p) => p.variation === "اللون")?.variation_prop ||
        "غير محدد";
      const size =
        variantProps.find((p) => p.variation === "المقاس")?.variation_prop ||
        "غير محدد";

      itemsDetails += `- ${productName},  عدد القطع: ${quantity}\n  اللون: ${color}\n  المقاس: ${size}\n للقطعة الواحدة السعر: ${price} ج.م\n\n`;
      totalQuantity += quantity; // جمع كمية المنتجات

      itemsDetailsForUrl.push({
        product: productName,
        quantity,
        color,
        size,
        price,
      });
    });

    // تحديد تكلفة الشحن إذا لم تكن موجودة
    let effectiveShippingCost;
    if (shipping_cost !== undefined && shipping_cost !== null) {
      effectiveShippingCost = shipping_cost;
    } else if (
      cost !== undefined &&
      cost !== null &&
      total_cost !== undefined &&
      total_cost !== null
    ) {
      effectiveShippingCost = total_cost - cost;
      console.log(
        `shipping_cost not provided, calculated as total_cost - cost: ${effectiveShippingCost}`
      );
    } else {
      effectiveShippingCost = 0;
      console.warn("Unable to determine shipping cost, defaulting to 0");
    }

    // الشحن والإجمالي
    const shippingLine =
      effectiveShippingCost > 0
        ? `الشحن: ${effectiveShippingCost} ج.م\n`
        : `الشحن: مجاني\n`;

    const totalLine =
      total_cost !== undefined && total_cost !== null
        ? `الإجمالي: ${total_cost} ج.م`
        : "الإجمالي: غير محدد";

    const queryParams = new URLSearchParams({
      full_name: full_name || "العميل العزيز",
      phone: phone,
      phone_alt: phone_alt || "غير متوفر",
      items: JSON.stringify(itemsDetailsForUrl), // تفاصيل المنتجات كـJSON
      shipping: effectiveShippingCost > 0 ? effectiveShippingCost : "مجاني",
      total:
        total_cost !== undefined && total_cost !== null
          ? total_cost
          : "غير محدد",
      government: government || "غير محدد",
      address: address || "غير محدد",
      country: country || "غير محدد",
    });
    const redirectUrl = `https://easy-orders-webhook-y9aj.vercel.app/track-order?${queryParams.toString()}`;

    // الرسالة الرئيسية
    const messageText = `مرحبًا بك ${
      full_name || "العميل العزيز"
    }\nرقم الهاتف: ${phone}\nرقم إضافي: ${
      phone_alt || "غير متوفر"
    }\n\nتفاصيل طلبك:\n${itemsDetails}${shippingLine}${totalLine}\n\nالمحافظة: ${
      government || "غير محدد"
    }\nالمنطقه: ${
      country || "غير محدد"
    }\n العنوان بالتفصيل:${address}\n\nبرجاء الضغط علي اللينك في الاسفل لارسال بيانات الطلب وتاكيد خروج الطلب مع شركه الشحن:\n${redirectUrl}`;

    // الرسالة النهائية
    const finalMessage = messageText;

    // التحقق من currentPhoneNumber
    if (!currentPhoneNumber) {
      console.error("currentPhoneNumber is not defined");
      return res.status(500).json({
        success: false,
        message:
          "Failed to send message: currentPhoneNumber is not defined. Please ensure the user has sent a message first.",
      });
    }

    // التحقق من phoneNumberId
    const phoneNumberId = "676367172217822";

    // إعداد رسالة واتساب
    const thankYouMessagePayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: {
        body: finalMessage,
      },
    };

    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const response = await axios.post(url, thankYouMessagePayload, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log(
      "Thank you message sent successfully:",
      JSON.stringify(response.data, null, 2)
    );
    res.status(200).send("EVENT_RECEIVED");
  } catch (error) {
    const errorMessage = error.response ? error.response.data : error.message;
    let detailedMessage = "Error processing EasyOrders webhook";

    if (error.response) {
      const status = error.response.status;
      const errorDetails = error.response.data?.error || {};

      if (status === 400) {
        detailedMessage = `Bad request to WhatsApp API: ${
          errorDetails.message || "Invalid payload"
        }`;
      } else if (status === 401) {
        detailedMessage = "Authentication failed: Check your ACCESS_TOKEN";
      } else if (status === 404) {
        detailedMessage = `Resource not found: Invalid phoneNumberId or endpoint URL`;
      } else if (status === 429) {
        detailedMessage =
          "Rate limit exceeded: Too many requests to WhatsApp API";
      } else {
        detailedMessage = `Unexpected error from WhatsApp API: ${
          errorDetails.message || "Unknown error"
        }`;
      }
    } else if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      detailedMessage = "Network error: Could not connect to WhatsApp API";
    } else {
      detailedMessage = `Internal server error: ${error.message}`;
    }

    console.error(
      "Error processing EasyOrders webhook:",
      JSON.stringify(errorMessage, null, 2)
    );
    console.error("Detailed error:", detailedMessage);

    res.status(500).json({
      success: false,
      message: "Error processing webhook",
      error: detailedMessage,
    });
  }
});

app.get("/track-order", (req, res) => {
  try {
    // استخراج الـparameters من الـquery
    const {
      full_name,
      phone,
      phone_alt,
      items,
      shipping,
      total,
      government,
      address,
      country,
    } = req.query;

    // التحقق من وجود الـparameters الأساسية
    const missingFields = [];
    if (!full_name) missingFields.push("full_name");
    if (!phone) missingFields.push("phone");
    if (!items) missingFields.push("items");

    if (missingFields.length > 0) {
      console.error(
        `Missing required query parameters: ${missingFields.join(", ")}`
      );
      return res
        .status(400)
        .send(`Missing required query parameters: ${missingFields.join(", ")}`);
    }

    // تحويل items من JSON إلى array
    let itemsDetails;
    try {
      itemsDetails = JSON.parse(items);
    } catch (error) {
      console.error("Failed to parse items parameter:", error.message);
      return res
        .status(400)
        .send("Invalid items parameter: must be a valid JSON string");
    }

    // بناء تفاصيل المنتجات
    let itemsText = "";
    itemsDetails.forEach((item) => {
      itemsText += `- ${item.product},  عدد القطع: ${item.quantity}\n  اللون: ${item.color}\n  المقاس: ${item.size}\n السعر للقطعة الواحده: ${item.price} ج.م\n\n`;
    });

    // بناء الرسالة
    const shippingLine =
      shipping === "مجاني" ? "الشحن: مجاني" : `الشحن: ${shipping} ج.م`;
    const totalLine =
      total !== "غير محدد" ? `الإجمالي: ${total} ج.م` : "الإجمالي: غير محدد";

    const messageText = `مرحبًا بك ${full_name}\n رقم الهاتف: ${phone}\n رقم إضافي: ${phone_alt}\n\n تفاصيل طلبك:\n${itemsText}${shippingLine}\n${totalLine}\n\n المحافظة: ${government}\n العنوان: ${country}\n العنوان بالتفصيل: ${address}\n\n`;

    // إنشاء الرابط النهائي لـwa.me
    const whatsappUrl = `https://wa.me/201016908760?text=${encodeURIComponent(
      messageText
    )}`;

    // Redirect تلقائي
    console.log("Redirecting to WhatsApp URL:", whatsappUrl);
    res.redirect(whatsappUrl);
  } catch (error) {
    console.error("Error in /track-order endpoint:", error.message);
    res
      .status(500)
      .send("Error processing track-order redirect: " + error.message);
  }
});

app.listen(port, () => {
  console.log(`Webhook server running on port ${port}`);
});
