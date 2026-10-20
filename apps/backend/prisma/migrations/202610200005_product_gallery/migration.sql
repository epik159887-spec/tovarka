ALTER TABLE "Product" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Product" SET "imageUrls" = ARRAY["imageUrl"];

-- Orders retain their historical item names, quantities and prices after product deletion.
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
