@ui @self-healing
Feature: Self-healing demo - the intentionally broken locators are detected
  pages/LegacyEmiPage.js keeps five deliberately broken locators (the brief asks for them to be left broken).
  Detection is the first stage of self-healing (see docs/SELF_HEALING.md), so these scenarios verify it:
  every broken locator must match nothing on the live page, while the element it was meant for still exists,
  and each locator carries the intent and kind that the healing script (npm run heal) needs.

  Background:
    Given I open the EMI app

  Scenario Outline: Broken locator <locator> is detected - it matches no element although its target exists
    Then the legacy locator "<locator>" matches no element on the page
    And the element it was meant for still exists on the page

    Examples:
      | locator           |
      | loanAmountInput   |
      | interestRateInput |
      | reportLink        |
      | emiResult         |
      | pieChart          |

  Scenario: Every broken locator records what a healer needs to repair it
    Then every legacy locator records its selector, its kind and a stated intent
    And exactly 5 legacy locators are kept
