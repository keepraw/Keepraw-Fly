export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // Existing component modifiers use BEM; is-onTime is the literal flight status.
    "selector-class-pattern":
      "^(?:[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?|is-onTime)$",
    // Retain the verified min/max breakpoints.
    "media-feature-range-notation": "prefix",
    // These are font family names, including in custom-property values.
    "value-keyword-case": [
      "lower",
      { ignoreKeywords: ["Arial", "BlinkMacSystemFont", "Consolas"] },
    ],
  },
  overrides: [
    {
      files: ["apps/web/src/styles/route-map.css"],
      rules: {
        // Chained :not() selectors have greater specificity than a selector list.
        // Keep the existing highlight rule's specificity unchanged.
        "selector-not-notation": "simple",
      },
    },
    {
      files: [
        "apps/web/src/styles/flight-detail.css",
        "apps/web/src/styles/flight-editor.css",
        "apps/web/src/styles/import.css",
        "apps/web/src/styles/passport.css",
        "apps/web/src/styles/passport-desktop.css",
        "apps/web/src/styles/route-map.css",
        "apps/web/src/styles/settings.css",
        "apps/web/src/styles/shell.css",
      ],
      rules: {
        // Leaf selectors belong to different DOM components/states. Stylelint
        // cannot infer that structure; reordering would risk the tested cascade.
        "no-descending-specificity": null,
      },
    },
    {
      files: [
        "apps/web/src/styles/flight-detail.css",
        "apps/web/src/styles/passport.css",
        "apps/web/src/styles/route-map.css",
      ],
      rules: {
        // These files deliberately layer later detail/archive/map overrides.
        // Merging repeated selectors would change their place in the cascade.
        "no-duplicate-selectors": null,
      },
    },
  ],
};
