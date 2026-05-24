/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6m2xuyw4xegw6ex")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_series_content_mogofm_old_id` ON `series_content_mogofm` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_content_mogofm_old_id` ON `series_content_mogofm` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("6m2xuyw4xegw6ex")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_series_content_mogofm_old_id` ON `series_content_mogofm` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
