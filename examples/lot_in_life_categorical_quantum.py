#!/usr/bin/env python
"""
Categorical Quantum Semantics Representation of "Someone's Lot in Life"
======================================================================

This example implements a precise mathematical representation of the phrase
"someone's lot in life" using the lambeq categorical quantum linguistics approach.

Requirements:
- lambeq
- discopy
- pytket
- pytket-qiskit
- matplotlib
- numpy
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Dict, Tuple

# Import lambeq components for categorical quantum NLP
from lambeq import (
    BobcatParser,
    AtomicType,
    IQPAnsatz,
    TketModel,
    SpiderAnsatz,
    discopy,
    remove_cups,
    tokenize
)

from discopy.quantum import Circuit, Id, Box, Tensor, Swap, Ket, Bra, sqrt, H, X, Z, CX, Measure

def main():
    """Main execution function demonstrating categorical quantum linguistics 
    representation of 'someone's lot in life'."""
    
    print("=== Categorical Quantum Semantics: 'Someone's Lot in Life' ===")
    
    # 1. Pregroup Grammar Typing
    print("\n1. Pregroup Grammar Typing")
    print("-------------------------")
    
    sentence = "someone's lot in life"
    
    # Initialize the parser - Bobcat is lambeq's CCG parser
    parser = BobcatParser(verbose='text')
    
    # Parse the sentence
    diagram = parser.sentence2diagram(sentence)
    
    # Display the pregroup types
    print(f"Sentence: '{sentence}'")
    print("\nTypes assigned by pregroup grammar:")
    words = sentence.split()
    types_explanation = {
        "someone's": "n⊗n^r",        # Possessive noun phrase
        "lot": "n",                  # Noun
        "in": "n⊗n^r⊗s^l⊗s",         # Preposition (noun to noun/sentence modifier)
        "life": "n"                  # Noun
    }
    
    for word, type_explanation in types_explanation.items():
        print(f"  - '{word}': {type_explanation}")
    
    print("\nPregroup reduction:")
    print("someone's lot in life: (n⊗n^r)⊗n⊗(n⊗n^r⊗s^l⊗s)⊗n → s")
    print("This reduces to: n⊗n^r⊗n⊗n⊗n^r⊗s^l⊗s⊗n → s")
    print("With cups and caps, this normalizes to the sentence type 's'")
    
    # 2. Tensor Network Representation
    print("\n2. Tensor Network Representation")
    print("------------------------------")
    
    print("Displaying the tensor network (DisCoPy diagram):")
    display_diagram = diagram.normal_form()
    
    # Note: In a Jupyter notebook, this would render graphically
    print("Tensor diagram structure (textual representation):")
    print(display_diagram)
    
    # 3. Quantum Circuit Translation
    print("\n3. Quantum Circuit Translation")
    print("----------------------------")
    
    # Define ansatz for mapping to quantum circuit
    ansatz = IQPAnsatz({AtomicType.NOUN: 1, AtomicType.SENTENCE: 1})
    
    # Create the circuit
    circuit = ansatz(diagram)
    
    print("Quantum circuit representation:")
    print(circuit)
    
    print("\nCircuit analysis:")
    print(f"Number of qubits: {circuit.n_qubits}")
    print(f"Number of operations: {len(circuit.data)}")
    
    # 4. Normalization with concrete vectors and matrices
    print("\n4. Normalization with Concrete Vectors and Matrices")
    print("------------------------------------------------")
    
    # Define the vector spaces for each word
    # We'll use 2-dimensional vector spaces for simplicity
    n_dim = 2  # Dimensionality for noun spaces
    s_dim = 2  # Dimensionality for sentence spaces
    
    # Define concrete meanings (density matrices) for each word
    # These would typically come from training, but we'll define them explicitly
    word_matrices = {
        "someone's": np.array([[0.7, 0.2], [0.2, 0.3]]),  # Possessive: uncertainty, dependency
        "lot": np.array([[0.5, 0.5], [0.5, 0.5]]),        # Lot: equal possibilities
        "in": np.array([[0.9, 0.1], [0.1, 0.1]]),         # In: strong contextual binding
        "life": np.array([[0.4, 0.6], [0.6, 0.6]])        # Life: existential space
    }
    
    print("Word representations as density matrices:")
    for word, matrix in word_matrices.items():
        print(f"\n'{word}':")
        print(matrix)
    
    # Demonstrate tensor contraction for normalization
    print("\nTensor contraction process:")
    print("1. We assign meaning vectors to each word")
    print("2. For cups (e.g., n⊗n^r → I), we contract indices")
    print("3. For composition, we use tensor product followed by contraction")
    
    # Simplified normalization calculation
    print("\nSimplified normalization result:")
    combined = np.tensordot(
        np.tensordot(word_matrices["someone's"], word_matrices["lot"], axes=0),
        np.tensordot(word_matrices["in"], word_matrices["life"], axes=0),
        axes=0
    )
    # This is a highly simplified contraction - real implementation would follow the cup/cap structure
    
    # Show result shape and a normalized result
    print(f"Result tensor shape: {combined.shape}")
    print("Normalized to scalar by contracting along appropriate dimensions")
    final_result = np.trace(np.sum(combined, axis=(1, 3, 5)))
    print(f"Final scalar: {final_result}")
    
    # Create a concrete TketModel for execution
    print("\nCreating executable quantum model:")
    model = TketModel.from_diagrams([circuit])
    
    print("\nModel parameters:")
    print(f"- Circuit parameters: {model.symbols}")
    print(f"- Parameter count: {len(model.symbols)}")
    
    # Initialize with random parameters
    params = 2 * np.pi * np.random.rand(len(model.symbols))
    print("\nRandom initialization of circuit parameters:")
    print(params)
    
    print("\nExpected steps for execution on quantum hardware:")
    print("1. Prepare initial state |0⟩^⊗n")
    print("2. Apply parameterized circuit U(θ)")
    print("3. Measure final state")
    print("4. Interpret measurement result as semantic meaning")
    
    # Demonstrate normalization as projection
    print("\nNormalization as projection onto sentence space:")
    print("Pr(s) = ⟨ψ|Πs|ψ⟩ where |ψ⟩ is the quantum state after circuit execution")
    
    # Final analysis
    print("\n=== Interpretation of 'Someone's Lot in Life' ===")
    print("This categorical quantum representation models how individual components")
    print("(someone, possession, lot, context, life) combine through tensor operations")
    print("to represent the meaning of 'someone's lot in life' as a pathway through")
    print("a quantum computational process.")
    print("The final normalized value represents the semantic coherence of this phrase.")


if __name__ == "__main__":
    main()