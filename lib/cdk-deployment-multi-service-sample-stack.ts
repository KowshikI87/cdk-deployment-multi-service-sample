import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'

export class CdkDeploymentMultiServiceSampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //create the vpc
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
    });

    // Create the ECS cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
    });


    // Create the service discovery namespace
    const namespace = new servicediscovery.PrivateDnsNamespace(this, 'Namespace', {
      name: 'myapp.local',
      vpc: vpc
    });

//--------------------------------------------app1Front---------------------------------------------------------------------
    // Create the task definition for app1front
    const taskDefinition1 = new ecs.FargateTaskDefinition(this, 'TaskDefinition1', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDefinition1.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
      resources: ['*'],
    }));

    // Define the container for app1front
    const container1 = taskDefinition1.addContainer('App1FrontContainer', {
      image: ecs.ContainerImage.fromRegistry('844738502783.dkr.ecr.ca-central-1.amazonaws.com/app1front:latest'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'App1Front',
        logGroup: new logs.LogGroup(this, 'App1FrontLogGroup', {
          logGroupName: '/ecs/App1Front',
          retention: logs.RetentionDays.ONE_WEEK
        })
      })
    });

    //had to add port mappings. Figur out why (kind of makes sense)
    container1.addPortMappings({
      containerPort: 3000,
      protocol: ecs.Protocol.TCP,
    });

    //Define the service for app1front
    const service1 = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service1", {
      cluster: cluster,
      taskDefinition: taskDefinition1,
      assignPublicIp: false,
      desiredCount: 1,
      listenerPort: 80,
      healthCheckGracePeriod: cdk.Duration.seconds(60)
    });

    //Define the service discovery service for app1front
      //had to remove healthCheck property (can't specify it for a private DNS)
    const service1Discovery = new servicediscovery.Service(this, "Service1Discovery", {
      namespace: namespace,
      name: "app1front",
      dnsRecordType: servicediscovery.DnsRecordType.A,
      dnsTtl: cdk.Duration.seconds(30),
    })

    //add target group for servic1 to allow communication with service discovery
    const targetGroup1 = service1.targetGroup

    service1.taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'servicediscovery:RegisterInstance',
        'servicediscovery:DeregisterInstance',
        'servicediscovery:DiscoverInstances'
      ],
      resources: [service1Discovery.serviceArn]
    }));



    //--------------------------------------------app2back--------------------------------
    
    // Define the container for app2back
    const taskDefinition2 = new ecs.FargateTaskDefinition(this, 'TaskDefinition2', {
      memoryLimitMiB: 512,
      cpu: 256,
    });

    taskDefinition2.addToTaskRolePolicy(new iam.PolicyStatement({
      actions: ['ecr:GetAuthorizationToken', 'ecr:BatchCheckLayerAvailability', 'ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage'],
      resources: ['*'],
    }));

    const container2 = taskDefinition2.addContainer('App2BackContainer', {
      image: ecs.ContainerImage.fromRegistry('844738502783.dkr.ecr.ca-central-1.amazonaws.com/app2back:latest'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'App2Back',
        logGroup: new logs.LogGroup(this, 'App2BackLogGroup', {
          logGroupName: '/ecs/App2Back',
          retention: logs.RetentionDays.ONE_WEEK
        })
      })
    });

    //had to add port mappings. Figur out why (kind of makes sense)
    container2.addPortMappings({
      containerPort: 3001,
      protocol: ecs.Protocol.TCP,
    });


    //Define the service for app2back
    const service2 = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "Service2", {
      cluster: cluster,
      taskDefinition: taskDefinition2,
      assignPublicIp: false,
      desiredCount: 1,
      listenerPort: 80,
      healthCheckGracePeriod: cdk.Duration.seconds(60)
    });

    //Define the service discovery service for app2back
      //had to remove healthCheck property (can't specify it for a private DNS)
    const service2Discovery = new servicediscovery.Service(this, "Service2Discovery", {
      namespace: namespace,
      name: "app2back",
      dnsRecordType: servicediscovery.DnsRecordType.A,
      dnsTtl: cdk.Duration.seconds(30),
    })

    //add target group for service2 to allow communication with service discovery
    const targetGroup2 = service2.targetGroup

    service2.taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
      actions: [
        'servicediscovery:RegisterInstance',
        'servicediscovery:DeregisterInstance',
        'servicediscovery:DiscoverInstances'
      ],
      resources: [service1Discovery.serviceArn]
    }));

  }
}
