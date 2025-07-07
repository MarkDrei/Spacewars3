import javax.swing.*;
import java.awt.*;
import java.awt.geom.Ellipse2D;

public class TorusInterceptVisualizer extends JPanel {

    // Simulation parameters
    static double x1 = 10, y1 = 50, s1 = 10;
    static double x2 = 460, y2 = 80, s2 = 2, phiDeg = 90;
    static double wrapSize = 500;

    // Results
    static double interceptX, interceptY, thetaDeg, distanceX, distanceY, t;
    static int bestKxX, bestKyX, bestKxY, bestKyY; // For debugging

    public static void main(String[] args) {
        computeIntercept();

        JFrame frame = new JFrame("Torus Interception Visualization");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(600, 600);
        frame.setContentPane(new TorusInterceptVisualizer());
        frame.setVisible(true);

        // Print results to console
        System.out.printf("Interception angle for X: %.2f degrees\n", thetaDeg);
        System.out.printf("Distance traveled by X: %.2f units\n", distanceX);
        System.out.printf("Distance traveled by Y: %.2f units\n", distanceY);
        System.out.printf("Time to intercept: %.2f units\n", t);
        System.out.printf("Interception point: (%.2f, %.2f)\n", interceptX, interceptY);
        System.out.printf("X image offset: (%d, %d), Y image offset: (%d, %d)\n", bestKxX, bestKyX, bestKxY, bestKyY);
    }

    public static void computeIntercept() {
        double phiRad = Math.toRadians(phiDeg);

        t = Double.POSITIVE_INFINITY;
        double bestThetaRad = 0;
        double bestInterceptX = 0, bestInterceptY = 0;
        double bestDistanceX = 0, bestDistanceY = 0;
        bestKxX = 0; bestKyX = 0; bestKxY = 0; bestKyY = 0;

        // Try all images of X and Y (shifting by -L, 0, +L in both axes)
        for (int kxX = -1; kxX <= 1; kxX++) {
            for (int kyX = -1; kyX <= 1; kyX++) {
                double x1i = x1 + kxX * wrapSize;
                double y1i = y1 + kyX * wrapSize;

                for (int kxY = -1; kxY <= 1; kxY++) {
                    for (int kyY = -1; kyY <= 1; kyY++) {
                        double x2i = x2 + kxY * wrapSize;
                        double y2i = y2 + kyY * wrapSize;

                        double dx = x2i - x1i;
                        double dy = y2i - y1i;

                        double cosPhi = Math.cos(phiRad);
                        double sinPhi = Math.sin(phiRad);

                        // Quadratic coefficients
                        double A = s2 * s2 - s1 * s1;
                        double B = 2 * s2 * (dx * cosPhi + dy * sinPhi);
                        double C = dx * dx + dy * dy;

                        double discriminant = B * B - 4 * A * C;

                        if (discriminant < 0) continue;

                        // Find the smallest positive t
                        double sqrtD = Math.sqrt(discriminant);
                        double t1 = (-B + sqrtD) / (2 * A);
                        double t2 = (-B - sqrtD) / (2 * A);

                        double tt = -1;
                        if (t1 > 0 && t2 > 0) tt = Math.min(t1, t2);
                        else if (t1 > 0) tt = t1;
                        else if (t2 > 0) tt = t2;
                        else continue;

                        // Calculate the interception angle for X
                        double vx = (dx / tt + s2 * cosPhi) / s1;
                        double vy = (dy / tt + s2 * sinPhi) / s1;
                        double thetaRad = Math.atan2(vy, vx);

                        // Calculate distances
                        double distanceX = s1 * tt;
                        double distanceY = s2 * tt;

                        // Interception point (on the torus)
                        double interceptX = (x1i + s1 * Math.cos(thetaRad) * tt) % wrapSize;
                        double interceptY = (y1i + s1 * Math.sin(thetaRad) * tt) % wrapSize;
                        if (interceptX < 0) interceptX += wrapSize;
                        if (interceptY < 0) interceptY += wrapSize;

                        // Update best solution
                        if (tt < t) {
                            t = tt;
                            thetaDeg = Math.toDegrees(thetaRad);
                            bestThetaRad = thetaRad;
                            TorusInterceptVisualizer.distanceX = distanceX;
                            TorusInterceptVisualizer.distanceY = distanceY;
                            TorusInterceptVisualizer.interceptX = interceptX;
                            TorusInterceptVisualizer.interceptY = interceptY;
                            bestKxX = kxX;
                            bestKyX = kyX;
                            bestKxY = kxY;
                            bestKyY = kyY;
                        }
                    }
                }
            }
        }

        if (!Double.isFinite(t)) {
            System.out.println("No interception possible.");
            t = -1;
        }
    }

    // Visualization and helpers (unchanged)
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        int size = 500;
        int margin = 40;
        double scale = (getWidth() - 2 * margin) / wrapSize;

        Graphics2D g2 = (Graphics2D) g;
        // Draw background
        g2.setColor(Color.WHITE);
        g2.fillRect(0, 0, getWidth(), getHeight());

        // Draw torus boundary
        g2.setColor(Color.LIGHT_GRAY);
        g2.drawRect(margin, margin, size, size);

        // Draw starting points
        drawPoint(g2, x1, y1, scale, margin, Color.BLUE, "X start");
        drawPoint(g2, x2, y2, scale, margin, Color.RED, "Y start");

        // Draw interception point
        if (t > 0) {
            drawPoint(g2, interceptX, interceptY, scale, margin, Color.GREEN.darker(), "Intercept");
        }

        // Optionally, draw paths
        if (t > 0) {
            // Path for X
            g2.setColor(new Color(0, 0, 255, 100));
            drawArrow(g2, x1, y1, interceptX, interceptY, scale, margin);

            // Path for Y
            double phiRad = Math.toRadians(phiDeg);
            double yEndX = (x2 + s2 * Math.cos(phiRad) * t) % wrapSize;
            double yEndY = (y2 + s2 * Math.sin(phiRad) * t) % wrapSize;
            if (yEndX < 0) yEndX += wrapSize;
            if (yEndY < 0) yEndY += wrapSize;
            g2.setColor(new Color(255, 0, 0, 100));
            drawArrow(g2, x2, y2, yEndX, yEndY, scale, margin);
        }
    }

    private void drawPoint(Graphics2D g2, double x, double y, double scale, int margin, Color color, String label) {
        int px = (int) (margin + x * scale);
        int py = (int) (margin + (wrapSize - y) * scale); // invert Y for graphics
        int r = 10;
        g2.setColor(color);
        g2.fill(new Ellipse2D.Double(px - r / 2, py - r / 2, r, r));
        g2.setColor(Color.BLACK);
        g2.drawString(label, px + 8, py - 8);
    }

    private void drawArrow(Graphics2D g2, double x0, double y0, double x1, double y1, double scale, int margin) {
        int px0 = (int) (margin + x0 * scale);
        int py0 = (int) (margin + (wrapSize - y0) * scale);
        int px1 = (int) (margin + x1 * scale);
        int py1 = (int) (margin + (wrapSize - y1) * scale);
        g2.setStroke(new BasicStroke(2));
        g2.drawLine(px0, py0, px1, py1);
        // Arrowhead
        double angle = Math.atan2(py1 - py0, px1 - px0);
        int len = 12;
        int aw = 6;
        int ax = px1 - (int) (len * Math.cos(angle - Math.PI / 8));
        int ay = py1 - (int) (len * Math.sin(angle - Math.PI / 8));
        g2.drawLine(px1, py1, ax, ay);
        ax = px1 - (int) (len * Math.cos(angle + Math.PI / 8));
        ay = py1 - (int) (len * Math.sin(angle + Math.PI / 8));
        g2.drawLine(px1, py1, ax, ay);
    }
}
