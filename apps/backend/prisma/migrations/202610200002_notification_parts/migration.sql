ALTER TABLE "Notification" ADD COLUMN "nextPart" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_nextPart_nonnegative" CHECK ("nextPart" >= 0);
ALTER TABLE "Order" ALTER COLUMN "total" TYPE DECIMAL(16,2);
ALTER TABLE "OrderItem" ALTER COLUMN "lineTotal" TYPE DECIMAL(16,2);
