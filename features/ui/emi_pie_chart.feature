@ui @pie-chart
Feature: EMI calculator - Home Loan pie chart
  As a borrower I want the EMI figures and the principal/interest pie chart to be correct
  so that I can trust the calculator.

  Background:
    Given I launch the EMI calculator

  Scenario Outline: Home loan EMI figures and pie chart - <name>
    When I open the "Home Loan" tab
    And I enter loan amount "<amount>", interest rate "<rate>" and tenure "<years>" years
    Then the displayed EMI, total interest and total payment match my own calculation
    And the pie chart is visible
    And both pie chart sections have values greater than zero
    And the pie chart split matches the calculated principal and interest share

    Examples:
      | name       | amount | rate | years |
      | Scenario A | 25L    | 10   | 10    |
      | Scenario B | 50L    | 7.5  | 15    |
