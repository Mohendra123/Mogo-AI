/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("40ug8ws8seouc6e")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "2gndrazj",
    "name": "user_id_old",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("40ug8ws8seouc6e")

  // remove
  collection.schema.removeField("2gndrazj")

  return dao.saveCollection(collection)
})
