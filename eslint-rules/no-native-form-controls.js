/**
 * ESLint rule: no-native-form-controls
 *
 * Forbids native <select> and <input type="date" | "datetime-local"> in JSX.
 * Use SearchableSelect / CountrySearchSelect / CountryCodeSelect instead of <select>.
 * Use DatePicker instead of <input type="date"> or <input type="datetime-local">.
 */

export const noNativeFormControls = {
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow native <select> and date <input> — use SearchableSelect and DatePicker instead.',
    },
    messages: {
      noSelect:
        'Use <SearchableSelect> (or CountrySearchSelect / CountryCodeSelect) instead of native <select>. ' +
        'Import from @/components/SearchableSelect.',
      noDateInput:
        'Use <DatePicker> instead of <input type="{{type}}">. ' +
        'Import from @/components/DatePicker.',
    },
    schema: [],
  },

  create(context) {
    return {
      JSXOpeningElement(node) {
        const name =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;

        if (name === 'select') {
          context.report({ node, messageId: 'noSelect' });
          return;
        }

        if (name === 'input') {
          const typeAttr = node.attributes.find(
            (a) =>
              a.type === 'JSXAttribute' &&
              a.name.name === 'type' &&
              a.value?.type === 'Literal' &&
              (a.value.value === 'date' || a.value.value === 'datetime-local')
          );
          if (typeAttr) {
            context.report({
              node,
              messageId: 'noDateInput',
              data: { type: typeAttr.value.value },
            });
          }
        }
      },
    };
  },
};
