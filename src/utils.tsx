import { update, get } from 'object-path-immutable';

export const separate = (data, {
  isItemContainer,
  containerItemsPath,
  containerKeyExtractor,
  keyExtractor,
}) => {
  const containerItems = [];
  const items = [];

  data.forEach(rootItem => {
    if (isItemContainer(rootItem)) {
      get(rootItem, containerItemsPath)
        .forEach(childItem => {
          items.push({
            id: keyExtractor(childItem),
            item: childItem,
          });
        });

      containerItems.push({
        id: containerKeyExtractor(rootItem),
        item: update(rootItem, containerItemsPath, () => []),
      });
    } else {
      items.push({
        id: keyExtractor(rootItem),
        item: rootItem,
      });
    }
  });
  return { containerItems, items };
};

