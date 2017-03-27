package main

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}


// ============================================================================================================================
// Asset Definitions
// ============================================================================================================================
type Applicant struct {
	PolicyNo string `json:"policyNo"`
	FirstName string `json:"firstName"`
	LastName string `json:"lastName"`
	Dob string `json:"dob"`
	Location Address `json:"address"`
	Gender string `json:"gender"`
	Weight string `json:"weight"`
	Height string `json:"height"`
}

type Insurance struct {
	InsID string `json:"insId"`
	Name string `json:"name"`
	InsAddress Address `json:"address"`
	AcctBalance int `json:"acctBalance"`
	InProgressReq []string `json:"inProgressReq"`
	CompletedReq []string `json:"completedReq"`
}

type Vendor struct {
	VendorID string `json:"vendorId"`
	Name string `json:"name"`
	Location Address `json:"address"`
	AcctBalance int `json:"acctBalance"`
	InProgressReq []string `json:"inProgressReq"`
	CompletedReq []string `json:"completedReq"`
}

type Operation struct {
	ReqID string `json:"reqId"`
	InsID string `json:"insId"`
	PolicyNo string `json:"policyNo"`
	VendorID string `json:"vendorId"`
	Screening struct {
		ID string `json:"id"`
		Type string `json:"type"`
		Status string `json:"status"`
		Hemoglobin string `json:"hemoglobin"`
		BloodValue string `json:"bloodValue"`
		DocID string `json:"docId"`
	} `json:"screening"`
	ScheduleDate string `json:"scheduleDate"`
	ScheduleTime string `json:"scheduleTime"`
	Status string `json:"status"`
	Pendingwith string `json:"pendingwith"`
}

type Address struct {
		Street string `json:"street"`
		State string `json:"state"`
		Zip string `json:"zip"`
		Phone string `json:"phone"`
}



// ============================================================================================================================
// Main
// ============================================================================================================================
func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode - %s", err)
	}
}

// ============================================================================================================================
// Init - reset all the things
// ============================================================================================================================
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	fmt.Println("Aggregator Is Starting Up")
	_, args := stub.GetFunctionAndParameters()
	var Aval int
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	// Initialize the chaincode
	Aval, err = strconv.Atoi(args[0])
	if err != nil {
		return shim.Error("Expecting integer value for asset holding")
	}

	// Write the state to the ledger
	err = stub.PutState("Aggregator", []byte(strconv.Itoa(Aval))) //making a test var "abc", I find it handy to read/write to it right away to test the network
	if err != nil {
		return shim.Error(err.Error())
	}

	
	fmt.Println(" - ready for action")
	return shim.Success(nil)
}

// ============================================================================================================================
// Invoke - Our entry point for Invocations
// ============================================================================================================================
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println(" ")
	fmt.Println("starting invoke, for - " + function)

	// Handle different functions
	if function == "init" {                   //initialize the chaincode state, used as reset
		return t.Init(stub)
	} else if function == "read" {            //generic read ledger
		return read(stub, args)
	} else if function == "write" {           //generic writes to ledger
		return write(stub, args)
	} 

	// error out
	fmt.Println("Received unknown invoke function name - " + function)
	return shim.Error("Received unknown invoke function name - '" + function + "'")
}


// ============================================================================================================================
// Query - legacy function
// ============================================================================================================================
func (t *SimpleChaincode) Query(stub shim.ChaincodeStubInterface) pb.Response {
	return shim.Error("Unknown supported call - Query()")
}

// ========================================================
// Make Timestamp - create a timestamp in ms
// ========================================================
func makeTimestamp() int64 {
	return time.Now().UnixNano() / (int64(time.Millisecond) / int64(time.Nanosecond))
}



// ========================================================
// Input Sanitation - dumb input checking, look for empty strings
// ========================================================
func sanitize_arguments(strs []string) error{
	for i, val:= range strs {
		if len(val) <= 0 {
			return errors.New("Argument " + strconv.Itoa(i) + " must be a non-empty string")
		}
		if len(val) > 32 {
			return errors.New("Argument " + strconv.Itoa(i) + " must be <= 32 characters")
		}
	}
	return nil
}