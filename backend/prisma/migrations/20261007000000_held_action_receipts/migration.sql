-- Recovery receipts are append-only evidence. Do not cascade-delete them with
-- an action record: held-action history is needed for operator investigation.
CREATE TABLE "HeldActionReceipt" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeldActionReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HeldActionReceipt_kind_actionId_key"
    ON "HeldActionReceipt"("kind", "actionId");
CREATE INDEX "HeldActionReceipt_guildId_createdAt_idx"
    ON "HeldActionReceipt"("guildId", "createdAt");

CREATE FUNCTION prevent_held_action_receipt_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Held action recovery receipts are immutable';
END;
$$;

CREATE TRIGGER "HeldActionReceipt_immutable"
BEFORE UPDATE OR DELETE ON "HeldActionReceipt"
FOR EACH ROW EXECUTE FUNCTION prevent_held_action_receipt_change();
