CREATE TABLE "OrderRequestKey" (
  "idempotencyKey" UUID NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OrderRequestKey_pkey" PRIMARY KEY ("idempotencyKey")
);
INSERT INTO "OrderRequestKey" ("idempotencyKey") SELECT "idempotencyKey" FROM "Order";
