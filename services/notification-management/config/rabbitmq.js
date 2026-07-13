import amqp from "amqplib";
import {
  EXCHANGE_NAME,
  EXCHANGE_TYPE,
  QUEUE_NAME,
  ROUTING_KEYS,
} from "../constants/eventTypes.js";

const getRabbitUrl = () => {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    throw new Error("RABBITMQ_URL is not configured");
  }
  return url;
};

export const connectRabbitMQ = async () => {
  const connection = await amqp.connect(getRabbitUrl());
  const channel = await connection.createChannel();

  await channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  for (const routingKey of ROUTING_KEYS) {
    await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, routingKey);
  }

  return { connection, channel };
};

export const closeRabbitMQ = async ({ connection, channel } = {}) => {
  try {
    if (channel) await channel.close();
  } catch (error) {
    console.warn("Notification Management: RabbitMQ channel close warning:", error.message);
  }

  try {
    if (connection) await connection.close();
  } catch (error) {
    console.warn(
      "Notification Management: RabbitMQ connection close warning:",
      error.message
    );
  }
};
