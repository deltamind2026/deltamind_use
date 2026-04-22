import numpy as np

def rarity_score(closes):
    returns = np.diff(closes)
    z = (returns[-1] - np.mean(returns)) / (np.std(returns) + 1e-9)

    rarity = min(abs(z) / 3, 1)

    return {
        "rarity_score": float(rarity),
        "z_score": float(z)
    }

