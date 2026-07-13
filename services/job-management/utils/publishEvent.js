import amqp from "amqplib";
import crypto from "node:crypto";
import { EXCHANGE_NAME, EXCHANGE_TYPE } from "../constants/eventTypes.js";

let publisherConnection = null;
let publisherChannel = null;
let connectPromise = null;

const getRabbitUrl = () => process.env.RABBITMQ_URL?.trim() || "";

const getPublisherChannel = async () => {
  if (publisherChannel) return publisherChannel;

  if (!connectPromise) {
    connectPromise = (async () => {
      const url = getRabbitUrl();
      if (!url) {
        throw new Error("RABBITMQ_URL is not configured");
      }

      publisherConnection = await amqp.connect(url);
      publisherChannel = await publisherConnection.createChannel();
      await publisherChannel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, {
        durable: true,
      });

      publisherConnection.on("close", () => {
        publisherConnection = null;
        publisherChannel = null;
        connectPromise = null;
      });

      return publisherChannel;
    })();
  }

  return connectPromise;
};

export const publishEvent = async (
  eventType,
  payload,
  sourceService = "job-management"
) => {
  if (!getRabbitUrl()) {
    console.warn("Job Management: RABBITMQ_URL missing, skipping event publish");
    return false;
  }

  try {
    const channel = await getPublisherChannel();
    const envelope = {
      eventId: crypto.randomUUID(),
      eventType,
      occurredAt: new Date().toISOString(),
      sourceService,
      payload,
    };

    channel.publish(
      EXCHANGE_NAME,
      eventType,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, contentType: "application/json" }
    );

    return true;
  } catch (error) {
    console.error(`Job Management: failed to publish ${eventType}:`, error.message);
    publisherConnection = null;
    publisherChannel = null;
    connectPromise = null;
    return false;
  }
};
