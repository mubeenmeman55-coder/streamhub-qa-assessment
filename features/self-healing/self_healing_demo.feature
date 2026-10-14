@ui @broken
Feature: Self-healing demo - intentionally broken locators
  These scenarios are EXPECTED TO FAIL. They are excluded from the default run (tag @broken) and exist
  to demonstrate detection of rotted locators. See docs/SELF_HEALING.md and `npm run heal`.

  Scenario: Legacy page object uses stale locators
    Given I open the EMI app
    When I use the legacy locators to enter amount "2500000" and rate "10"
    Then the legacy EMI result and pie chart are visible
    And the legacy Report link can be opened
