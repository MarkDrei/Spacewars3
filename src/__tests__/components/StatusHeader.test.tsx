import { describe, expect, vi, test, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusHeader from "@/components/StatusHeader/StatusHeader";
import "@testing-library/jest-dom/vitest";

describe('StatusHeader', () => {
  const defaultProps = {
    ironAmount: 1000,
    statusIndicator: 'grey' as const,
    onStatusClick: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('statusHeader_defaultProps_rendersCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} />);

    // Assert - Text is split across spans
    expect(screen.getByText('Iron:')).toBeInTheDocument();
    expect(screen.getByText('1.000')).toBeInTheDocument(); // German locale uses dots
    expect(screen.getByTitle('Status indicator')).toBeInTheDocument();
  });

  test('statusHeader_formatsLargeNumbers_withLocaleFormat', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={1234567} />);

    // Assert - Use toLocaleString format (dots in German locale)
    expect(screen.getByText('1.234.567')).toBeInTheDocument();
  });

  test('statusHeader_zeroIron_displaysZero', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={0} />);

    // Assert
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('statusHeader_clickStatusIndicator_callsOnStatusClick', () => {
    // Arrange
    const mockOnStatusClick = vi.fn();

    // Act
    render(<StatusHeader {...defaultProps} onStatusClick={mockOnStatusClick} isClickable={true} />);
    // Find all indicators and click the one with 'clickable' class
    const indicators = screen.getAllByTitle('Status indicator');
    const clickableIndicator = indicators.find(el => el.classList.contains('clickable'));
    fireEvent.click(clickableIndicator!);

    // Assert
    expect(mockOnStatusClick).toHaveBeenCalledTimes(1);
  });

  test('statusHeader_notClickable_doesNotCallOnStatusClick', () => {
    // Arrange
    const mockOnStatusClick = vi.fn();

    // Act
    render(<StatusHeader {...defaultProps} onStatusClick={mockOnStatusClick} isClickable={false} />);
    // Find all indicators and click the first one (none should be clickable)
    const indicators = screen.getAllByTitle('Status indicator');
    fireEvent.click(indicators[0]);

    // Assert
    expect(mockOnStatusClick).not.toHaveBeenCalled();
  });

  test('statusHeader_loadingState_showsLoadingIndicator', () => {
    // Act
    render(<StatusHeader {...defaultProps} isLoading={true} />);

    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  test('statusHeader_greyIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="grey" />);

    // Assert
    const indicators = screen.getAllByTitle('Status indicator');
    // Find the one with 'grey' class
    const indicator = indicators.find(el => el.classList.contains('grey'));
    expect(indicator).toHaveClass('status-indicator', 'grey');
  });

  test('statusHeader_redIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="red" />);

    // Assert
    const indicators = screen.getAllByTitle('Status indicator');
    const indicator = indicators.find(el => el.classList.contains('red'));
    expect(indicator).toHaveClass('status-indicator', 'red');
  });

  test('statusHeader_greenIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="green" />);

    // Assert
    const indicators = screen.getAllByTitle('Status indicator');
    const indicator = indicators.find(el => el.classList.contains('green'));
    expect(indicator).toHaveClass('status-indicator', 'green');
  });

  test('statusHeader_fractionalIron_formatsCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={1234.67} />);

    // Assert - Check for the actual formatted output
    expect(screen.getByText('1.234,67')).toBeInTheDocument();
  });

  test('statusHeader_negativeIron_handlesCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={-100} />);

    // Assert
    expect(screen.getByText('-100')).toBeInTheDocument();
  });

  test('statusHeader_veryLargeNumber_formatsCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={9876543210} />);

    // Assert - Use dots for German locale
    expect(screen.getByText('9.876.543.210')).toBeInTheDocument();
  });

  test('statusHeader_withoutLoading_doesNotShowLoadingText', () => {
    // Act
    const { container } = render(<StatusHeader {...defaultProps} isLoading={false} />);

    // Assert
    // Only check iron-amount spans inside this StatusHeader
    const ironAmounts = Array.from(container.querySelectorAll('.iron-amount'));
    expect(ironAmounts.some(el => el.textContent === '...')).toBe(false);
  });

  test('statusHeader_loadingWithIronAmount_showsLoadingNotIron', () => {
    // Act
    render(<StatusHeader {...defaultProps} isLoading={true} ironAmount={500} />);

    // Assert
    const loadingEls = screen.getAllByText('...');
    expect(loadingEls.length).toBeGreaterThan(0);
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });
});
