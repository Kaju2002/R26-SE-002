import { connectRabbitMQ, closeRabbitMQ } from "../config/rabbitmq.js";
import { handleEvent } from "../handlers/eventHandlers.js";

let consumerState = {
  connection: null,
  channel: null,
  started: false,
};

const parseMessage = (message) => {
  const raw = message.content.toString("utf8");
  return JSON.parse(raw);
};

export const startRabbitConsumer = async () => {
  if (consumerState.started) {
    return consumerState;
  }

  const { connection, channel } = await connectRabbitMQ();
  consumerState = { connection, channel, started: true };

  await channel.prefetch(10);

  await channel.consume(
    "notification-service.queue",
    async (message) => {
      if (!message) return;

      try {
        const event = parseMessage(message);
        const result = await handleEvent(event);
        console.log(
          `Notification consumer processed ${event.eventType} (${event.eventId}):`,
          result
        );
        channel.ack(message);
      } catch (error) {
        console.error("Notification consumer error:", error.message);
        channel.nack(message, false, false);
      }
    },
    { noAck: false }
  );

  connection.on("close", () => {
    console.warn("Notification Management: RabbitMQ connection closed");
    consumerState.started = false;
  });

  connection.on("error", (error) => {
    console.error("Notification Management: RabbitMQ connection error:", error.message);
  });

  console.log("Notification Management: RabbitMQ consumer started");
  return consumerState;
};

export const stopRabbitConsumer = async () => {
  await closeRabbitMQ(consumerState);
  consumerState = { connection: null, channel: null, started: false };
};

export const startRabbitConsumerWithRetry = async ({
  retries = 10,
  delayMs = 3000,
} = {}) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await startRabbitConsumer();
    } catch (error) {
      console.error(
        `Notification Management: RabbitMQ connect attempt ${attempt}/${retries} failed:`,
        error.message
      );

      if (attempt === retries) {
        console.warn(
          "Notification Management: continuing without RabbitMQ consumer (REST API still available)"
        );
        return null;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  return null;
};
