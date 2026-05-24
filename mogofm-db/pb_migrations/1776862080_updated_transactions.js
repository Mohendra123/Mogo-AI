/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("899668hwnc4qqu9")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_transactions_old_id` ON `transactions` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_transactions_old_id` ON `transactions` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_transactions_old_id` ON `transactions` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("899668hwnc4qqu9")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_transactions_old_id` ON `transactions` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_transactions_old_id` ON `transactions` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
