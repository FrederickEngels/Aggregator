package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// ============================================================================================================================
// Write - genric write variable into ledger
// ============================================================================================================================
func write(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var name, value string // Entities
	var err error
	fmt.Println("starting write")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2. name of the variable and value to set")
	}

	// input sanitation
	err = sanitize_arguments(args)
	if err != nil {
		return shim.Error(err.Error())
	}

	name = args[0] //rename for funsies
	value = args[1]
	err = stub.PutState(name, []byte(value)) //write the variable into the ledger
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println("- end write")
	return shim.Success(nil)
}

func init_applicant(stub shim.ChaincodeStubInterface, args []byte) pb.Response {
	var err error
	fmt.Println("starting init_applicant")
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 6")
	}

	var applicant Applicant
	err := json.Unmarshal(args, &applicant)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(applicant.PolicyNo, []byte(applicant)) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

}


func init_vendor(stub shim.ChaincodeStubInterface, args []byte) pb.Response {
	var err error
	fmt.Println("starting init_vendor")
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 6")
	}

	var vendor Vendor
	err := json.Unmarshal(args, &vendor)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(vendor.VendorID, []byte(applicant)) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

}


func init_insurance(stub shim.ChaincodeStubInterface, args []byte) pb.Response {
	var err error
	fmt.Println("starting init_insurance")
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 6")
	}

	var insurance Insurance
	err := json.Unmarshal(args, &insurance)
	if err != nil {
		return shim.Error(err.Error())
	}

	err = stub.PutState(insurance.InsID, []byte(applicant)) //store marble with id as key
	if err != nil {
		return shim.Error(err.Error())
	}

}
