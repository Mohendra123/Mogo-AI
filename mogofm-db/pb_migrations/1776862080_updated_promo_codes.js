/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("kwmkpvys2jnyk5h")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_promo_codes_old_id` ON `promo_codes` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_promo_codes_old_id` ON `promo_codes` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("kwmkpvys2jnyk5h")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_promo_codes_old_id` ON `promo_codes` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
