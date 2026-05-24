/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("51cg0dgfdqysygs")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)"
  ]

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("51cg0dgfdqysygs")

  collection.indexes = [
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)",
    "CREATE INDEX IF NOT EXISTS `idx_series_ratings_old_id` ON `series_ratings` (`old_id`)"
  ]

  return dao.saveCollection(collection)
})
