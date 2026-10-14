@ui @bar-chart
Feature: EMI calculator - Personal Loan bar chart
  As a borrower I want the yearly payment bar chart to reflect my loan and chosen start month.

  Background:
    Given I launch the EMI calculator

  Scenario: Personal loan bar chart, sliders and start month
    When I open the "Personal Loan" tab
    And I set the sliders to amount "10L", interest rate "12" and tenure "5" years
    And I choose "Jan 2027" in the "Schedule showing EMI payments starting from" calendar
    Then the displayed EMI, total interest and total payment match my own calculation
    And the bar chart is visible
    And the bar chart has one interest bar and one principal bar for each year of the schedule
    And the tooltip of the first bar matches the calculated schedule for the first year
