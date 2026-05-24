/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("c9w66klqyhsu57o")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_episodes_mogofm_old_id` ON `episodes_mogofm` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_episodes_mogofm_old_id` ON `episodes_mogofm` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("c9w66klqyhsu57o")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_episodes_mogofm_old_id` ON `episodes_mogofm` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
