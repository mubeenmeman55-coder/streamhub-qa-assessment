@ui @webapp
Feature: EMI calculator app - loan insights and affordability

  Background:
    Given I open the EMI app

  Scenario Outline: Insights match an independent calculation - <amount> at <rate>% for <years> years
    When I enter loan amount "<amount>", rate "<rate>", tenure "<years>" "Years" and calculate
    Then the cost of every hundred rupees borrowed matches my own calculation
    And the month principal overtakes interest matches my own closed-form calculation

    Examples:
      | amount      | rate | years |
      | 25,00,000   | 10   | 10    |
      | 50,00,000   | 7.5  | 15    |
      | 10,00,000   | 12   | 5     |
      | 1,00,00,000 | 9.25 | 30    |

  Scenario Outline: Affordability is rated from the EMI share of income - income <income>
    When I enter a monthly income of "<income>" and calculate
    Then the affordability shows "<status>" at the EMI share of income

    Examples:
      | income    | status      |
      | 1,50,000  | comfortable |
      | 80,000    | stretching  |
      | 50,000    | risky       |

  Scenario: Without an income the affordability box is hidden
    When I enter loan amount "25,00,000", rate "10", tenure "10" "Years" and calculate
    Then the affordability box is not shown

  Scenario Outline: Invalid income is rejected - <income>
    When I enter a monthly income of "<income>" and calculate
    Then the "income" field shows the error "Income must be a positive number."

    Examples:
      | income |
      | -5     |
      | abc    |
      | 0      |

  Scenario: The share link keeps the income
    When I enter a monthly income of "1,50,000" and calculate
    And I copy the share link
    And I open the share link
    Then the affordability shows "comfortable" at the EMI share of income
