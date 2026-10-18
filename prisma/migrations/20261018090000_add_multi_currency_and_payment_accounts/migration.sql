-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Currency') THEN
    CREATE TYPE "Currency" AS ENUM ('YER_OLD', 'YER_NEW', 'SAR', 'USD');
  END IF;
END $$;

-- AlterTable Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "priceYerOld" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "discountedPriceYerOld" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "priceYerNew" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "discountedPriceYerNew" DECIMAL(12,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "priceSar" DECIMAL(10,2);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "discountedPriceSar" DECIMAL(10,2);

-- CreateTable PaymentAccount
CREATE TABLE IF NOT EXISTS "PaymentAccount" (
    "id" SERIAL NOT NULL,
    "providerTitle" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "currency" "Currency",
    "instructions" TEXT,
    "qrCodeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex PaymentAccount
CREATE INDEX IF NOT EXISTS "PaymentAccount_isActive_idx" ON "PaymentAccount"("isActive");
CREATE INDEX IF NOT EXISTS "PaymentAccount_order_idx" ON "PaymentAccount"("order");

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" "Currency" NOT NULL DEFAULT 'YER_OLD';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "transactionNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentAccountId" INTEGER;

-- CreateIndex Payment
CREATE INDEX IF NOT EXISTS "Payment_paymentAccountId_idx" ON "Payment"("paymentAccountId");
CREATE INDEX IF NOT EXISTS "Payment_currency_idx" ON "Payment"("currency");

-- AddForeignKey Payment
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_paymentAccountId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "PaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

