#!/usr/bin/env python
"""
Advanced Categorical Quantum Semantics for "Someone's Lot in Life"
==================================================================

This example provides a more detailed mathematical implementation using
pregroup grammars, string diagrams, and quantum circuits via DisCoPy and lambeq.

Requirements:
- lambeq
- discopy 
- pytket
- pytket-qiskit
- numpy
- matplotlib
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import matplotlib.pyplot as plt

from lambeq import (
    BobcatParser,
    AtomicType,
    IQPAnsatz,
    SpiderAnsatz,
    TketModel,
    discopy
)

from discopy.grammar.pregroup import Word, Cup, Swap, Id, Diagram, Ty
from discopy.quantum import Circuit, Box, Measure, CX, H, Ket, Bra

# Define atomic types
n = AtomicType.NOUN       # Noun type
s = AtomicType.SENTENCE   # Sentence type

# Define compound types
n_r = n.r                 # Right adjoint of noun
n_l = n.l                 # Left adjoint of noun
s_r = s.r                 # Right adjoint of sentence
s_l = s.l                 # Left adjoint of sentence

def create_pregroup_diagram():
    """Create the pregroup diagram for 'someone's lot in life'"""
    
    # Define the types for each word
    types = {
        "someone's": n @ n_r,             # Possessive: n⊗n^r
        "lot": n,                         # Noun: n
        "in": n @ n_r @ s_l @ s,          # Preposition: n⊗n^r⊗s^l⊗s
        "life": n                         # Noun: n
    }
    
    # Create word boxes
    someone_s = Word("someone's", types["someone's"])
    lot = Word("lot", types["lot"])
    in_prep = Word("in", types["in"])
    life = Word("life", types["life"])
    
    # Construct the diagram
    words = someone_s @ lot @ in_prep @ life
    
    # Add cups for contractions
    cups = Id(n) @ Cup(n, n_r) @ Id(n) @ Cup(n, n_r) @ Id(s_l @ s @ n)
    diagram = words >> cups
    
    # Add remaining cups for full reduction
    second_cups = Id(n) @ Cup(s_l, s) @ Id(n)
    diagram = diagram >> second_cups
    
    # Final contraction to sentence type
    final_cup = Cup(n, n_r)
    diagram = diagram >> final_cup
    
    return diagram

def analyze_tensor_structure(diagram: Diagram):
    """Analyze the tensor structure of the diagram"""
    
    # Extract word boxes
    words = [box for box in diagram.boxes if isinstance(box, Word)]
    
    # Extract cups (contractions)
    cups = [box for box in diagram.boxes if isinstance(box, Cup)]
    
    analysis = {
        "words": [word.name for word in words],
        "word_types": [str(word.cod) for word in words],
        "connections": [(cup.dom[0].name, cup.dom[1].name) for cup in cups],
        "tensor_dimensions": len(cups) + 1  # Dimensionality of the tensor network
    }
    
    return analysis

def create_concrete_meanings():
    """Create concrete meaning matrices for each word"""
    
    # Define 2D vector spaces for simplicity
    dim_n = 2  # Dimension for noun space
    dim_s = 2  # Dimension for sentence space
    
    # Create concrete tensors for each word
    meanings = {
        # someone's: n⊗n^r (2x2 matrix)
        "someone's": np.array([
            [0.7, 0.3],  # Individual identity component
            [0.3, 0.3]   # Possessive relationship component
        ]),
        
        # lot: n (2D vector)
        "lot": np.array([
            0.5,  # Determination component 
            0.5   # Randomness/fate component
        ]),
        
        # in: n⊗n^r⊗s^l⊗s (2x2x2x2 tensor) - simplified
        "in": np.array([
            [[[0.8, 0.2], [0.1, 0.1]],  # Context binding tensors
             [[0.1, 0.1], [0.2, 0.1]]],
            [[[0.1, 0.1], [0.2, 0.1]],
             [[0.1, 0.0], [0.1, 0.1]]]
        ]),
        
        # life: n (2D vector)
        "life": np.array([
            0.6,  # Temporal component
            0.4   # Experience component
        ])
    }
    
    return meanings

def quantum_circuit_representation(diagram: Diagram):
    """Create a quantum circuit representation using IQP ansatz"""
    
    # Define the ansatz for circuit creation
    ansatz = IQPAnsatz({AtomicType.NOUN: 1, AtomicType.SENTENCE: 1})
    
    # Convert diagram to quantum circuit
    circuit = ansatz(diagram)
    
    # Extract circuit information
    info = {
        "n_qubits": circuit.n_qubits,
        "depth": len(circuit.data),
        "gates": [gate.name for gate in circuit.data],
        "circuit": circuit
    }
    
    return info

def normalize_meanings(meanings, diagram):
    """Perform manual normalization of meanings according to diagram structure"""
    
    # This is a simplified calculation that follows the tensor contraction
    # in the pregroup diagram, but doesn't fully implement all steps
    
    # First contraction: someone's ⊗ lot
    someone_s_lot = np.outer(meanings["someone's"][0], meanings["lot"])
    
    # Second contraction: in ⊗ life
    in_life = np.tensordot(
        meanings["in"], 
        meanings["life"],
        axes=0
    )
    
    # Final contraction approximation
    result = np.tensordot(someone_s_lot.flatten(), in_life.reshape(-1), axes=0)
    
    # Normalize to get probability-like value
    result_normalized = np.abs(result) / np.sum(np.abs(result))
    
    return {
        "someone_s_lot": someone_s_lot,
        "in_life": in_life,
        "result_full": result,
        "result_normalized": result_normalized
    }

def main():
    """Main execution function"""
    
    print("=== Advanced Categorical Quantum Analysis of 'Someone's Lot in Life' ===\n")
    
    # 1. Create and analyze pregroup diagram
    print("1. Pregroup Grammar Analysis")
    print("---------------------------")
    
    diagram = create_pregroup_diagram()
    analysis = analyze_tensor_structure(diagram)
    
    print(f"Sentence: 'someone's lot in life'")
    print("\nPregroup types:")
    for word, typ in zip(analysis["words"], analysis["word_types"]):
        print(f"  - {word}: {typ}")
    
    print("\nReduction process:")
    print("  (n⊗n^r)⊗n⊗(n⊗n^r⊗s^l⊗s)⊗n → s")
    print("  with steps:")
    print("  1. Connect n^r from 'someone's' with first n from 'in'")
    print("  2. Connect s^l from 'in' with s")
    print("  3. Connect n^r with final n from 'life'")
    print("  Result: sentence type s")
    
    print(f"\nDiagram structure: {diagram}")
    
    # 2. Tensor network representation
    print("\n2. Tensor Network Representation")
    print("------------------------------")
    
    # Create concrete meanings
    meanings = create_concrete_meanings()
    
    print("Concrete meaning representations:")
    for word, tensor in meanings.items():
        print(f"\n'{word}':")
        print(tensor)
    
    # Perform normalization
    normalization = normalize_meanings(meanings, diagram)
    
    print("\nIntermediate tensor products:")
    print("  'someone's lot':")
    print(normalization["someone_s_lot"])
    print("\n  'in life':")
    print(normalization["in_life"].shape) # Too large to print fully
    
    print("\nFinal normalized meaning:")
    print(normalization["result_normalized"])
    
    # 3. Quantum circuit representation
    print("\n3. Quantum Circuit Translation")
    print("----------------------------")
    
    circuit_info = quantum_circuit_representation(diagram)
    
    print(f"Quantum circuit with {circuit_info['n_qubits']} qubits")
    print(f"Circuit depth: {circuit_info['depth']}")
    print(f"Gate sequence types: {set(circuit_info['gates'])}")
    print("\nCircuit representation:")
    print(circuit_info['circuit'])
    
    # 4. Normalization as quantum measurement
    print("\n4. Quantum Normalization Process")
    print("------------------------------")
    
    # Create concrete quantum model
    ansatz = IQPAnsatz({AtomicType.NOUN: 1, AtomicType.SENTENCE: 1})
    circuit = ansatz(diagram)
    model = TketModel.from_diagrams([circuit])
    
    # Initialize random parameters
    n_params = len(model.symbols)
    params = 2 * np.pi * np.random.rand(n_params)
    
    print(f"Model has {n_params} parameters")
    print("\nParameter initialization:")
    print(params)
    
    print("\nQuantum normalization as projection:")
    print("  |ψ⟩ = U(θ)|0⟩^⊗n")
    print("  Probability of meaning = |⟨1|ψ⟩|²")
    print("  where |1⟩ represents the 'true' semantic meaning")
    
    # 5. Interpretation
    print("\n5. Categorical Quantum Interpretation")
    print("-----------------------------------")
    
    print("This mathematical formalism captures the following:")
    print("  1. 'someone's' establishes a possessive relationship (n⊗n^r)")
    print("  2. 'lot' represents a noun concept of fate/circumstance (n)")
    print("  3. 'in' places this lot within a context (n⊗n^r⊗s^l⊗s)")
    print("  4. 'life' provides the domain of this context (n)")
    print("\nThe tensor contractions model how these concepts interact")
    print("The quantum circuit provides a computational pathway for this meaning")
    print("The final normalized representation gives a mathematical model of the")
    print("phrase's meaning that could be compared with other phrases or used")
    print("for semantic analysis.")

if __name__ == "__main__":
    main()