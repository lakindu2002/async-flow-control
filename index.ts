import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import AWS_SDK = require("aws-sdk");

const queue = new aws.sqs.Queue("message-queue", {
  delaySeconds: 10, // 10 second message delay
  messageRetentionSeconds: 1209600, // 14 days
  sqsManagedSseEnabled: true,
  visibilityTimeoutSeconds: 30,
});

const sendMessageToQueueFunction = new aws.lambda.CallbackFunction(
  "sendMessageToQueueFunction",
  {
    memorySize: 2024,
    timeout: 200,
    callback: async () => {
      const sqs = new AWS_SDK.SQS({ region: "us-east-1" });
      const queueUrl = queue.id.get();

      // Simulate an irregular load by sending about 100 events with random delays
      for (let i = 0; i < 100; i++) {
        // Introduce a random delay (between 1 and 10 seconds) before sending each event
        const delaySeconds = Math.floor(Math.random() * 10) + 1;
        await new Promise((resolve) =>
          setTimeout(resolve, delaySeconds * 1000)
        );

        // Send a message to the SQS queue
        await sqs
          .sendMessage({ QueueUrl: queueUrl, MessageBody: `Event ${i + 1}` })
          .promise();
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ status: "SUCCESS" }),
      };
    },
  }
);

const processQueueFunction = new aws.lambda.CallbackFunction(
  "processQueueFunction",
  {
    callback: async (event: aws.sqs.QueueEvent) => {
      await Promise.all(
        event.Records.map(async (record) => {
          console.log(JSON.stringify({ record }));

          const sqs = new AWS_SDK.SQS({ region: "us-east-1" });
          await sqs
            .deleteMessage({
              QueueUrl: queue.url.get(),
              ReceiptHandle: record.receiptHandle,
            })
            .promise();
        })
      );
    },
    memorySize: 2400,
    timeout: 30,
  }
);

queue.onEvent("onPush", processQueueFunction);
