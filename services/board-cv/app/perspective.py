"""Perspektif duzeltme: kullanici koseleri (normalize) -> tepeden-duz normalize board."""
import cv2
import numpy as np

from .geometry import BOARD_NORMALIZED_WIDTH as OW, BOARD_NORMALIZED_HEIGHT as OH


def warp_from_corners(bgr: np.ndarray, corners: list[tuple[float, float]]) -> np.ndarray:
    """corners: [TL, TR, BR, BL] normalize (0..1). Ciktilar OW x OH BGR."""
    h, w = bgr.shape[:2]
    src = np.float32([(cx * w, cy * h) for cx, cy in corners])
    dst = np.float32([(0, 0), (OW, 0), (OW, OH), (0, OH)])
    m = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(bgr, m, (OW, OH))


def corners_valid(corners: list[tuple[float, float]]) -> bool:
    """Sinir/mesafe/alan/kesisim kontrolu (frontend ile ayni mantik)."""
    if len(corners) != 4:
        return False
    for x, y in corners:
        if x < -0.02 or x > 1.02 or y < -0.02 or y > 1.02:
            return False
    for i in range(4):
        for j in range(i + 1, 4):
            if np.hypot(corners[i][0] - corners[j][0], corners[i][1] - corners[j][1]) < 0.08:
                return False
    area = 0.0
    sign = 0
    for i in range(4):
        a, b, c = corners[i], corners[(i + 1) % 4], corners[(i + 2) % 4]
        area += a[0] * b[1] - b[0] * a[1]
        cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        s = (cross > 0) - (cross < 0)
        if s != 0:
            if sign == 0:
                sign = s
            elif s != sign:
                return False
    return abs(area) / 2 >= 0.15
